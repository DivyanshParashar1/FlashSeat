import { type FastifyPluginAsync } from 'fastify';
import * as reservationController from '../controllers/reservations.controller.js';

const createReservationParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', format: 'uuid' },
  },
};
const createReservationBodySchema = {
  type: 'object',
  required: ['seatIds', 'idempotencyKey'],
  additionalProperties: false,
  properties: {
    seatIds: {
      type: 'array',
      minItems: 1,
      maxItems: 10,
      uniqueItems: true,
      items: { type: 'string', format: 'uuid' },
    },
    idempotencyKey: { type: 'string', minLength: 8, maxLength: 128 },
  },
};

const createReservationResponseSchema = {
  type: 'object',
  required: ['reservationId', 'heldUntil'],
  properties: {
    reservationId: { type: 'string' },
    heldUntil: { type: 'string', format: 'date-time' },
  },
};

export interface CreateReservationBody {
  seatIds: string[];
  idempotencyKey: string;
}

const reservationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { id: string }; Body: CreateReservationBody }>(
    '/events/:id/reservations',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: createReservationParamsSchema,
        body: createReservationBodySchema,
        response: {
          200: createReservationResponseSchema,
          201: createReservationResponseSchema,
        },
      },
    },
    reservationController.createReservation,
  );
};

export default reservationRoutes;
