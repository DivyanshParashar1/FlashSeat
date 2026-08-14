import * as eventsController from '../controllers/events.controller.js';
import { type FastifyPluginAsync } from 'fastify';

const eventsResponseSchema = {
  type: 'object',
  required: ['events'],
  properties: {
    events: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'date', 'venue', 'availableSeats'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          date: { type: 'string', format: 'date-time' },
          venue: { type: ['string', 'null'] },
          availableSeats: { type: 'number' },
        },
      },
    },
  },
};

const seatsResponseSchema = {
  type: 'object',
  required: ['seats'],
  properties: {
    seats: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'seatNumber', 'price', 'status'],
        properties: {
          id: { type: 'string' },
          seatNumber: { type: 'string' },
          price: { type: 'integer' },
          status: { type: 'string', enum: ['available', 'held', 'sold'] },
        },
      },
    },
  },
};
const seatsParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', format: 'uuid' },
  },
};

const eventsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    {
      schema: {
        response: {
          '2xx': eventsResponseSchema,
        },
      },
    },
    eventsController.listEvents,
  );
  fastify.get<{ Params: { id: string } }>(
    '/:id/seats',
    {
      schema: {
        params: seatsParamsSchema,
        response: {
          '2xx': seatsResponseSchema,
        },
      },
    },
    eventsController.getSeatMap,
  );
};

export default eventsRoute;
