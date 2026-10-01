import { type FastifyPluginAsync } from 'fastify';
import * as reservationController from '../controllers/reservations.controller.js';
import * as paymentController from '../controllers/payment.controller.js';

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

  fastify.delete<{ Params: { id: string } }>(
    '/reservations/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: { 204: { type: 'null' } },
      },
    },
    reservationController.releaseReservation,
  );
  fastify.post<{ Params: { id: string } }>(
    '/reservations/:id/checkout',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: {
            type: 'object',
            required: ['orderId', 'amount', 'currency', 'keyId'],
            properties: {
              orderId: { type: 'string' },
              amount: { type: 'integer', minimum: 0 },
              currency: { type: 'string', const: 'INR' },
              keyId: { type: 'string' },
            },
          },
        },
      },
    },
    paymentController.createCheckout,
  );
};

export default reservationRoutes;
