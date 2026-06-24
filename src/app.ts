import Fastify from 'fastify';

export const server = Fastify({
  logger: true,
});

server.get('/health', async (_request, _reply) => {
  return { status: 'ok' };
});
