import { type FastifyPluginAsync } from 'fastify';
import * as bookingController from '../controllers/bookings.controller.js';

const bookingResponseSchema = {
  type: 'object',
  required: ['bookings'],
  properties: {
    bookings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['bookingId', 'createdAt', 'event', 'seat'],
        properties: {
          bookingId: { type: 'string', format: 'uuid' },
          createdAt: { type: 'string', format: 'date-time' },
          event: {
            type: 'object',
            required: ['id', 'name', 'date', 'venue'],
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              date: { type: 'string', format: 'date-time' },
              venue: { type: ['string', 'null'] },
            },
          },
          seat: {
            type: 'object',
            required: ['id', 'seatNumber', 'price'],
            properties: {
              id: { type: 'string', format: 'uuid' },
              seatNumber: { type: 'string' },
              price: { type: 'number' },
            },
          },
        },
      },
    },
  },
};

const bookingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/bookings',
    {
      preHandler: [fastify.authenticate],
      schema: { response: { 200: bookingResponseSchema } },
    },
    bookingController.listBookings,
  );
};

export default bookingRoutes;
