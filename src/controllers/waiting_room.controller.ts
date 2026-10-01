import { type FastifyReply, type FastifyRequest } from 'fastify';
import { enqueue, peek, queueDepth } from '../services/waiting_room.service.js';

export const joinQueue = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  const eventId = request.params.id;
  const userId = request.user.userId;
  const result = await enqueue(eventId, userId);
  if (!result) return reply.serviceUnavailable('Waiting room unavailable');
  return reply.code(201).send(result);
};

export const checkPosition = async (
  request: FastifyRequest<{
    Params: { id: string };
    Querystring: { token: string };
  }>,
  reply: FastifyReply,
) => {
  const { id: eventId } = request.params;
  const { token } = request.query;
  if (!token) return reply.badRequest('token query param required');
  const pos = await peek(eventId, token);
  if (!pos) return reply.notFound('Token not in queue');
  return reply.code(200).send(pos);
};

export const queueStatus = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  const depth = await queueDepth(request.params.id);
  return reply.code(200).send({ depth });
};
