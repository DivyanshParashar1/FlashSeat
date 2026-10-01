import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';

export class InvalidWebhookSignatureError extends Error {
  constructor(message = 'Invalid webhook signature') {
    super(message);
    this.name = 'InvalidWebhookSignatureError';
  }
}

export interface RazorpayWebhookEvent {
  id: string; // event id (e.g. "evt_...")
  event: string; // e.g. "payment.captured"
  payload: {
    payment?: { entity?: { id?: string; order_id?: string; amount?: number } };
    [k: string]: unknown;
  };
}

export const verifyWebhookSignature = (
  server: FastifyInstance,
  rawBody: Buffer,
  signatureHeader: string | undefined,
): void => {
  if (!signatureHeader)
    throw new InvalidWebhookSignatureError('Missing signature header');

  const expected = crypto
    .createHmac('sha256', server.config.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signatureHeader, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new InvalidWebhookSignatureError();
  }
};

export const parseWebhookEvent = (rawBody: Buffer): RazorpayWebhookEvent => {
  const parsed = JSON.parse(rawBody.toString('utf8'));
  if (typeof parsed?.event !== 'string') {
    throw new Error('Webhook body missing event field');
  }
  return parsed as RazorpayWebhookEvent;
};
