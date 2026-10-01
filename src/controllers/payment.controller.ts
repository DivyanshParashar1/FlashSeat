import * as paymentService from '../services/payment.service.js';
import { type FastifyReply, type FastifyRequest } from 'fastify';

export const createCheckout = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  const reservationId = request.params.id;
  const userId = request.user.userId;

  try {
    const result = await paymentService.createCheckout(request.server, {
      reservationId,
      userId,
    });
    return reply.code(200).send(result);
  } catch (err) {
    if (err instanceof paymentService.ReservationNotFoundError) {
      return reply.notFound(err.message);
    }
    if (err instanceof paymentService.ReservationNotPayableError) {
      return reply.conflict(err.message);
    }
    throw err;
  }
};

export const verifyPayment = async (
  request: FastifyRequest<{
    Body: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    };
  }>,
  reply: FastifyReply,
) => {
  const userId = request.user.userId;
  try {
    const result = await paymentService.verifyPaymentSignature(request.server, {
      ...request.body,
      userId,
    });
    return reply.code(200).send(result);
  } catch (err) {
    if (err instanceof paymentService.InvalidPaymentSignatureError) {
      return reply.unauthorized(err.message);
    }
    throw err;
  }
};
