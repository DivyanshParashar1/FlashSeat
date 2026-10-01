import { type FastifyPluginAsync } from 'fastify';
import * as controller from '../controllers/waiting_room.controller.js';

const idParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
};

const waitingRoomRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { id: string } }>(
    '/events/:id/queue',
    {
      preHandler: [fastify.authenticate],
      schema: { params: idParamsSchema },
    },
    controller.joinQueue,
  );
  fastify.get<{ Params: { id: string }; Querystring: { token: string } }>(
    '/events/:id/queue',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: idParamsSchema,
        querystring: {
          type: 'object',
          required: ['token'],
          properties: { token: { type: 'string', minLength: 1 } },
        },
      },
    },
    controller.checkPosition,
  );
  fastify.get<{ Params: { id: string } }>(
    '/events/:id/queue/depth',
    { schema: { params: idParamsSchema } },
    controller.queueStatus,
  );
};

export default waitingRoomRoutes;
