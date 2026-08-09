import * as eventsService from '../services/events.service.js';
import { type FastifyRequest, type FastifyReply } from 'fastify';

export const listEvents = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const event = await eventsService.liveEvents();
  if (!event[0]) {
    reply.conflict('No events live, or no seats available');
  }
  return reply.code(200).send({
    events: event,
  });
};
