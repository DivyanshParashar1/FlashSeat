import { type FastifyPluginAsync } from 'fastify';
import * as adminController from '../controllers/admin.controller.js';
import type * as adminService from '../services/admin.service.js';

const createEventBodySchema = {
  type: 'object',
  required: ['name', 'date'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 200 },
    date: { type: 'string', format: 'date-time' },
    venue: { type: ['string', 'null'], maxLength: 200 },
  },
};

const bulkSeatsParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
};

const bulkSeatsBodySchema = {
  type: 'object',
  required: ['rows'],
  additionalProperties: false,
  properties: {
    rows: {
      type: 'array',
      minItems: 1,
      maxItems: 50,
      items: {
        type: 'object',
        required: ['label', 'count', 'price'],
        additionalProperties: false,
        properties: {
          label: { type: 'string', minLength: 1, maxLength: 10 },
          count: { type: 'integer', minimum: 1, maximum: 500 },
          price: { type: 'integer', minimum: 0 },
        },
      },
    },
  },
};

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireAdmin);

  fastify.post(
    '/events',
    { schema: { body: createEventBodySchema } },
    adminController.createEvent,
  );
  fastify.get('/events', adminController.listEvents);
  fastify.post<{
    Params: { id: string };
    Body: { rows: adminService.SeatRowSpec[] };
  }>(
    '/events/:id/seats',
    { schema: { params: bulkSeatsParamsSchema, body: bulkSeatsBodySchema } },
    adminController.bulkCreateSeats,
  );
};

export default adminRoutes;
