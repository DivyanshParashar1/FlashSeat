import * as eventsService from '../services/events.service.js';
import { type FastifyRequest, type FastifyReply } from 'fastify';

export const listEvents = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const event = await eventsService.liveEvents();
  return reply.code(200).send({
    events: event,
  });
};

export const getSeatMap = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  const id = request.params.id;
  const eventExists = await eventsService.eventExists(id);
  if (!eventExists) {
    return reply.notFound('Event not found');
  }
  const seats = await eventsService.getSeatMap(id);
  return reply.code(200).send({ seats });
};
