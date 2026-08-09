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
};

export default eventsRoute;
