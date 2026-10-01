import { type FastifyPluginAsync } from 'fastify';
import * as paymentController from '../controllers/payment.controller.js';

const verifyBodySchema = {
  type: 'object',
  required: ['razorpayOrderId', 'razorpayPaymentId', 'razorpaySignature'],
  additionalProperties: false,
  properties: {
    razorpayOrderId: { type: 'string', minLength: 1 },
    razorpayPaymentId: { type: 'string', minLength: 1 },
    razorpaySignature: { type: 'string', minLength: 1 },
  },
};

const paymentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    };
  }>(
    '/verify',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: verifyBodySchema,
        response: {
          200: {
            type: 'object',
            required: ['status'],
            properties: { status: { type: 'string', const: 'verified' } },
          },
        },
      },
    },
    paymentController.verifyPayment,
  );
};

export default paymentRoutes;
