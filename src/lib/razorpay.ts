import Razorpay from 'razorpay';
import type { FastifyInstance } from 'fastify';

let client: Razorpay | undefined;

export const getRazorpay = (server: FastifyInstance): Razorpay => {
  if (!client) {
    client = new Razorpay({
      key_id: server.config.RAZORPAY_TEST_KEY,
      key_secret: server.config.RAZORPAY_TEST_KEY_SECRET,
    });
  }
  return client;
};
