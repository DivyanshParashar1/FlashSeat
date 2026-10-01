import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { payments } from '../db/schema/payments.schema.js';
import { reservations } from '../db/schema/reservations.schema.js';
import { reservationSeats } from '../db/schema/reservation_seats.schema.js';
import { seats } from '../db/schema/seats.schema.js';
import { eq, sql } from 'drizzle-orm';
import { getRazorpay } from '../lib/razorpay.js';

export class ReservationNotPayableError extends Error {
  constructor(message = 'Reservation cannot be paid in its current state') {
    super(message);
    this.name = 'ReservationNotPayableError';
  }
}

export class ReservationNotFoundError extends Error {
  constructor(message = 'Reservation not found') {
    super(message);
    this.name = 'ReservationNotFoundError';
  }
}

export interface CheckoutInput {
  reservationId: string;
  userId: string;
}

export interface CheckoutResult {
  orderId: string;
  amount: number;
  currency: 'INR';
  keyId: string;
}

export const createCheckout = async (
  server: FastifyInstance,
  input: CheckoutInput,
): Promise<CheckoutResult> => {
  const { reservationId, userId } = input;

  // 1. Fetch reservation + sum amount in one go.
  const rows = await db
    .select({
      id: reservations.id,
      userId: reservations.userId,
      status: reservations.status,
      expiresAt: reservations.expiresAt,
      amount: sql<number>`coalesce(sum(${seats.price}), 0)::int`,
    })
    .from(reservations)
    .innerJoin(
      reservationSeats,
      eq(reservationSeats.reservationId, reservations.id),
    )
    .innerJoin(seats, eq(seats.id, reservationSeats.seatId))
    .where(eq(reservations.id, reservationId))
    .groupBy(reservations.id);

  const reservation = rows[0];
  if (!reservation || reservation.userId !== userId) {
    throw new ReservationNotFoundError();
  }

  if (reservation.status !== 'pending') {
    throw new ReservationNotPayableError(
      `Reservation is ${reservation.status}, cannot be paid`,
    );
  }
  if (reservation.expiresAt.getTime() < Date.now()) {
    throw new ReservationNotPayableError('Reservation has expired');
  }

  // 2. Idempotent create of payments row (unique on reservation_id).
  //    If a payment row already exists with a razorpay_order_id, return it.
  const existing = await db
    .select({
      razorpayOrderId: payments.razorpayOrderId,
      amount: payments.amount,
    })
    .from(payments)
    .where(eq(payments.reservationId, reservationId));

  if (existing[0]?.razorpayOrderId) {
    return {
      orderId: existing[0].razorpayOrderId,
      amount: existing[0].amount,
      currency: 'INR',
      keyId: server.config.RAZORPAY_TEST_KEY,
    };
  }

  // 3. Reserve the slot (idempotent — ON CONFLICT by reservation_id).
  await db
    .insert(payments)
    .values({
      reservationId,
      amount: reservation.amount,
      status: 'pending',
    })
    .onConflictDoNothing({ target: payments.reservationId });

  // 4. Call Razorpay.
  const razorpay = getRazorpay(server);
  const order = await razorpay.orders.create({
    amount: reservation.amount,
    currency: 'INR',
    receipt: `reservation:${reservationId}`,
  });

  // 5. Persist the Razorpay order ID.
  await db
    .update(payments)
    .set({ razorpayOrderId: order.id })
    .where(eq(payments.reservationId, reservationId));

  return {
    orderId: order.id,
    amount: reservation.amount,
    currency: 'INR',
    keyId: server.config.RAZORPAY_TEST_KEY,
  };
};
