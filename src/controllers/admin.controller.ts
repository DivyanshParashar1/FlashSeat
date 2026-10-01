import * as adminService from '../services/admin.service.js';
import { type FastifyReply, type FastifyRequest } from 'fastify';

export const createEvent = async (
  request: FastifyRequest<{
    Body: { name: string; date: string; venue?: string | null };
  }>,
  reply: FastifyReply,
) => {
  const { name, date, venue } = request.body;
  const row = await adminService.createEvent({
    name,
    date: new Date(date),
    venue: venue ?? null,
  });
  return reply.code(201).send(row);
};

export const listEvents = async (_req: FastifyRequest, reply: FastifyReply) => {
  const rows = await adminService.listAllEvents();
  return reply.code(200).send({ events: rows });
};

export const bulkCreateSeats = async (
  request: FastifyRequest<{
    Params: { id: string };
    Body: { rows: adminService.SeatRowSpec[] };
  }>,
  reply: FastifyReply,
) => {
  try {
    const result = await adminService.bulkCreateSeats(
      request.params.id,
      request.body.rows,
    );
    return reply.code(201).send(result);
  } catch (err) {
    if (err instanceof adminService.EventNotFoundError) {
      return reply.notFound(err.message);
    }
    throw err;
  }
};
