import crypto from 'node:crypto';
import Fastify from 'fastify';
import fastifyEnv from '@fastify/env';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import jwt from '@fastify/jwt';
import { startSweeper } from './services/sweeper.service.js';

const schema = {
  type: 'object',
  required: [
    'PORT',
    'DATABASE_URL',
    'ORIGINS',
    'JWT_SECRET',
    'JWT_EXPIRY',
    'RESERVATION_LOCK_STRATEGY',
    'RAZORPAY_TEST_KEY',
    'RAZORPAY_TEST_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET',
  ],
  properties: {
    PORT: { type: 'string', default: '3000' },
    DATABASE_URL: { type: 'string' },
    ORIGINS: { type: 'string', default: '*' },
    JWT_SECRET: { type: 'string' },
    JWT_EXPIRY: { type: 'string', default: '1h' },
    RESERVATION_LOCK_STRATEGY: {
      type: 'string',
      enum: ['pessimistic', 'optimistic'],
      default: 'pessimistic',
    },
    SWEEPER_INTERVAL_MS: { type: 'number', default: 30000 },
    RAZORPAY_TEST_KEY: { type: 'string' },
    RAZORPAY_TEST_KEY_SECRET: { type: 'string' },
    RAZORPAY_WEBHOOK_SECRET: { type: 'string' },
  },
};

export const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    redact: [
      'req.headers.authorization',
      'req.headers["x-razorpay-signature"]',
      '*.razorpaySignature',
      '*.razorpay_signature',
      '*.password',
    ],
  },
  genReqId: () => {
    return crypto.randomUUID();
  },
  disableRequestLogging: false,
});

const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS ?? 500);

server.addHook('onResponse', async (request, reply) => {
  const elapsed = reply.elapsedTime;
  if (elapsed > SLOW_REQUEST_MS) {
    request.log.warn(
      {
        reqId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        elapsedMs: elapsed,
      },
      'slow request',
    );
  }
});

server.register(fastifyEnv, {
  confKey: 'config',
  dotenv: true,
  schema,
});

server.register(helmet, { contentSecurityPolicy: false });

server.after(() => {
  server.register(cors, {
    origin: server.config.ORIGINS.split(',').map((origin) => origin.trim()),
  });
  server.register(jwt, {
    secret: server.config.JWT_SECRET,
    sign: {
      expiresIn: server.config.JWT_EXPIRY,
    },
  });
  server.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.send(err);
    }
  });
  server.decorate('requireAdmin', async function (request, reply) {
    if (!request.user.isAdmin) reply.forbidden();
  });
});

server.register(sensible, {
  sharedSchemaId: 'HttpError',
});

let sweeper: { stop: () => void } | undefined;

server.addHook('onClose', async () => {
  sweeper?.stop();
});

server.ready(() => {
  sweeper = startSweeper(server.config.SWEEPER_INTERVAL_MS, server.log);
});

// route import
import authRoutes from './routes/auth.routes.js';
import eventsRoute from './routes/events.routes.js';
import reservationRoutes from './routes/reservations.routes.js';
import bookingRoutes from './routes/bookings.routes.js';
import adminRoutes from './routes/admin.routes.js';
import paymentRoutes from './routes/payments.routes.js';
import webhookRoutes from './routes/webhooks.routes.js';

// routes
server.register(reservationRoutes, { prefix: '/api/v1' });
server.register(bookingRoutes, { prefix: '/api/v1' });
server.register(authRoutes, { prefix: '/api/v1/auth' });
server.register(eventsRoute, { prefix: '/api/v1/events' });
server.register(adminRoutes, { prefix: '/api/v1/admin' });
server.register(paymentRoutes, { prefix: '/api/v1/payments' });
server.register(webhookRoutes, { prefix: '/api/v1/webhooks' });

server.get('/health', async () => {
  return { status: 'ok' };
});
