import { type FastifyReply, type FastifyRequest } from 'fastify';
import { subscribe } from '../services/seat_updates.service.js';

export const streamSeatUpdates = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  const eventId = request.params.id;

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  reply.raw.write(`event: connected\ndata: ${JSON.stringify({ eventId })}\n\n`);

  const unsubscribe = subscribe(eventId, (payload) => {
    reply.raw.write(`event: seat_update\ndata: ${payload}\n\n`);
  });

  const heartbeat = setInterval(() => {
    reply.raw.write(`: heartbeat\n\n`);
  }, 15000);
  heartbeat.unref();

  const cleanup = () => {
    clearInterval(heartbeat);
    unsubscribe();
    reply.raw.end();
  };

  request.raw.on('close', cleanup);
  request.raw.on('aborted', cleanup);
};
