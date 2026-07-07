import Fastify from 'fastify';
import fastifyEnv from '@fastify/env';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';

const schema = {
  type: 'object',
  required: ['PORT', 'DATABASE_URL', 'ORIGINS'],
  properties: {
    PORT: { type: 'string', default: '3000' },
    DATABASE_URL: { type: 'string' },
    ORIGINS: { type: 'string', default: '*' },
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
});

server.register(sensible, {
  sharedSchemaId: 'HttpError',
});

server.get('/health', async () => {
  return { status: 'ok' };
});
