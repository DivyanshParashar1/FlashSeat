import * as bookingService from '../services/booking.service.js';
import { type FastifyReply, type FastifyRequest } from 'fastify';

export const listBookings = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const userId = request.user.userId;
  const bookings = await bookingService.listBookingsForUser(userId);
  return reply.code(200).send({ bookings });
};
