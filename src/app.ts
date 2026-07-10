import Fastify from 'fastify';
import fastifyEnv from '@fastify/env';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import jwt from '@fastify/jwt';

const schema = {
  type: 'object',
  required: ['PORT', 'DATABASE_URL', 'ORIGINS', 'JWT_SECRET', 'JWT_EXPIRY'],
  properties: {
    PORT: { type: 'string', default: '3000' },
    DATABASE_URL: { type: 'string' },
    ORIGINS: { type: 'string', default: '*' },
    JWT_SECRET: { type: 'string' },
    JWT_EXPIRY: { type: 'string', default: '1h' },
  },
};

export const server = Fastify({
  logger: true,
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
});

server.register(sensible, {
  sharedSchemaId: 'HttpError',
});

// route import
import authRoutes from './routes/auth.routes.js';

// routes

server.register(authRoutes, { prefix: '/api/v1/auth' });

server.get('/health', async () => {
  return { status: 'ok' };
});
