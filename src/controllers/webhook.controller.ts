import * as webhookService from '../services/webhook.service.js';
import { type FastifyReply, type FastifyRequest } from 'fastify';
import {
  handlePaymentCaptured,
  handlePaymentFailed,
} from '../services/payment_webhook.service.js';

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

  try {
    switch (event.event) {
      case 'payment.captured':
        await handlePaymentCaptured(request.server, event, request.server.log);
        break;
      case 'payment.failed':
        await handlePaymentFailed(event, request.server.log);
        break;
      default:
        request.server.log.info(
          { eventType: event.event },
          'razorpay webhook unhandled event',
        );
    }
  } catch (err) {
    request.server.log.error(
      { err, eventId: event.id },
      'webhook handler failed',
    );
    throw err; // falls through to Fastify's 500 → Razorpay retries
  }

  return reply.code(200).send({ status: 'ok' });
};
