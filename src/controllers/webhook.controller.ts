import * as webhookService from '../services/webhook.service.js';
import { type FastifyReply, type FastifyRequest } from 'fastify';

export const razorpayWebhook = async (
  request: FastifyRequest & { rawBody?: Buffer },
  reply: FastifyReply,
) => {
  const rawBody = request.rawBody;
  if (!rawBody) return reply.badRequest('Missing raw body');

  const sig = request.headers['x-razorpay-signature'];
  const sigStr = Array.isArray(sig) ? sig[0] : sig;

  try {
    webhookService.verifyWebhookSignature(request.server, rawBody, sigStr);
  } catch (err) {
    if (err instanceof webhookService.InvalidWebhookSignatureError) {
      return reply.unauthorized(err.message);
    }
    throw err;
  }

  let event;
  try {
    event = webhookService.parseWebhookEvent(rawBody);
  } catch {
    return reply.badRequest('Invalid webhook body');
  }

  request.server.log.info(
    { eventType: event.event, payloadKeys: Object.keys(event.payload ?? {}) },
    'razorpay webhook received',
  );

  // TODO(P2-6/P2-7): dispatch to payment.captured / payment.failed handlers
  return reply.code(200).send({ status: 'ok' });
};
