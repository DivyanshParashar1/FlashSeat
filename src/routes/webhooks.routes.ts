import { type FastifyPluginAsync } from 'fastify';
import * as webhookController from '../controllers/webhook.controller.js';

const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  // Preserve raw body for signature verification.
  // Scoped to THIS plugin only; other routes keep default JSON parsing.
  // Capture raw body for HMAC verification; defer JSON parsing to the handler
  // so bad JSON surfaces as a controlled 400, not Fastify's default 500.
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => {
      (req as unknown as { rawBody: Buffer }).rawBody = body as Buffer;
      done(null, body);
    },
  );

  fastify.post('/razorpay', webhookController.razorpayWebhook);
};

export default webhookRoutes;
