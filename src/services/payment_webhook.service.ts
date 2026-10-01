import { db } from '../db/index.js';
import { payments } from '../db/schema/payments.schema.js';
import { reservations } from '../db/schema/reservations.schema.js';
import { reservationSeats } from '../db/schema/reservation_seats.schema.js';
import { seats } from '../db/schema/seats.schema.js';
import { bookings } from '../db/schema/bookings.schema.js';
import { processed_webhook_events } from '../db/schema/processed_webhook_events.schema.js';
import { eq, inArray, sql } from 'drizzle-orm';
import type { RazorpayWebhookEvent } from './webhook.service.js';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import { getRazorpay } from '../lib/razorpay.js';
import { broadcast } from './seat_updates.service.js';

export const handlePaymentCaptured = async (
  server: FastifyInstance,
  event: RazorpayWebhookEvent,
  log: FastifyBaseLogger,
): Promise<{
  status: 'processed' | 'duplicate' | 'orphaned' | 'refunded';
}> => {
  const paymentEntity = event.payload.payment?.entity;
  const razorpayOrderId = paymentEntity?.order_id;
  const razorpayPaymentId = paymentEntity?.id;
  if (!razorpayOrderId || !razorpayPaymentId) {
    throw new Error('payment.captured event missing order_id or payment_id');
  }

  return await db.transaction(async (tx) => {
    // 1. Dedup — insert event, zero rows means we've seen it.
    const dedup = await tx
      .insert(processed_webhook_events)
      .values({ razorpayEventId: event.id })
      .onConflictDoNothing({ target: processed_webhook_events.razorpayEventId })
      .returning({ id: processed_webhook_events.razorpayEventId });
    if (dedup.length === 0) {
      log.info({ eventId: event.id }, 'webhook duplicate — already processed');
      return { status: 'duplicate' as const };
    }

    // 2. Find the payment row + reservation (locked).
    const rows = await tx
      .select({
        paymentId: payments.id,
        reservationId: payments.reservationId,
        reservationStatus: reservations.status,
      })
      .from(payments)
      .innerJoin(reservations, eq(reservations.id, payments.reservationId))
      .where(eq(payments.razorpayOrderId, razorpayOrderId))
      .for('update');

    const row = rows[0];
    if (!row) {
      // Payment row doesn't exist — maybe webhook came for an order we don't know
      // about. Record the event as processed so Razorpay stops retrying.
      log.warn({ razorpayOrderId }, 'webhook for unknown order; dropping');
      return { status: 'orphaned' as const };
    }

    if (row.reservationStatus !== 'pending') {
      log.warn(
        {
          reservationId: row.reservationId,
          status: row.reservationStatus,
          razorpayPaymentId,
        },
        'payment.captured for non-pending reservation — expiry race, initiating refund',
      );
      await tx
        .update(payments)
        .set({ status: 'failed', razorpayPaymentId })
        .where(eq(payments.id, row.paymentId));

      try {
        const razorpay = getRazorpay(server);
        const refund = await razorpay.payments.refund(razorpayPaymentId, {
          speed: 'normal',
          notes: {
            reason: 'expiry_race',
            reservationId: row.reservationId,
          },
        });
        log.info(
          { refundId: refund.id, razorpayPaymentId },
          'refund initiated for orphaned payment',
        );
      } catch (err) {
        log.error(
          { err, razorpayPaymentId },
          'refund failed; manual intervention required',
        );
      }

      return { status: 'refunded' as const };
    }

    // 4. Flip payment → succeeded.
    await tx
      .update(payments)
      .set({ status: 'succeeded', razorpayPaymentId })
      .where(eq(payments.id, row.paymentId));

    // 5. Flip reservation → confirmed.
    await tx
      .update(reservations)
      .set({ status: 'confirmed' })
      .where(eq(reservations.id, row.reservationId));

    const soldSeats = await tx
      .update(seats)
      .set({
        status: 'sold',
        heldBy: null,
        heldUntil: null,
        version: sql`${seats.version} + 1`,
      })
      .where(
        inArray(
          seats.id,
          tx
            .select({ id: reservationSeats.seatId })
            .from(reservationSeats)
            .where(eq(reservationSeats.reservationId, row.reservationId)),
        ),
      )
      .returning({ id: seats.id, eventId: seats.eventId });

    for (const s of soldSeats) {
      broadcast(s.eventId, { seatId: s.id, status: 'sold' });
    }

    // 7. Insert booking rows.
    if (soldSeats.length > 0) {
      // Fetch userId once from the reservation.
      const resv = await tx
        .select({ userId: reservations.userId })
        .from(reservations)
        .where(eq(reservations.id, row.reservationId));
      const userId = resv[0]?.userId;
      if (!userId)
        throw new Error('reservation missing userId during booking creation');

      await tx.insert(bookings).values(
        soldSeats.map((s) => ({
          reservationId: row.reservationId,
          userId,
          seatId: s.id,
        })),
      );
    }

    log.info(
      {
        eventId: event.id,
        reservationId: row.reservationId,
        seats: soldSeats.length,
      },
      'payment.captured processed',
    );
    return { status: 'processed' as const };
  });
};

export const handlePaymentFailed = async (
  event: RazorpayWebhookEvent,
  log: FastifyBaseLogger,
): Promise<{ status: 'processed' | 'duplicate' | 'orphaned' }> => {
  const paymentEntity = event.payload.payment?.entity;
  const razorpayOrderId = paymentEntity?.order_id;
  const razorpayPaymentId = paymentEntity?.id;
  if (!razorpayOrderId || !razorpayPaymentId) {
    throw new Error('payment.failed event missing order_id or payment_id');
  }

  return await db.transaction(async (tx) => {
    const dedup = await tx
      .insert(processed_webhook_events)
      .values({ razorpayEventId: event.id })
      .onConflictDoNothing({ target: processed_webhook_events.razorpayEventId })
      .returning({ id: processed_webhook_events.razorpayEventId });
    if (dedup.length === 0) {
      log.info({ eventId: event.id }, 'webhook duplicate — already processed');
      return { status: 'duplicate' as const };
    }

    const rows = await tx
      .select({
        paymentId: payments.id,
        reservationId: payments.reservationId,
        reservationStatus: reservations.status,
      })
      .from(payments)
      .innerJoin(reservations, eq(reservations.id, payments.reservationId))
      .where(eq(payments.razorpayOrderId, razorpayOrderId))
      .for('update');

    const row = rows[0];
    if (!row) {
      log.warn(
        { razorpayOrderId },
        'payment.failed for unknown order; dropping',
      );
      return { status: 'orphaned' as const };
    }

    if (row.reservationStatus !== 'pending') {
      log.warn(
        { reservationId: row.reservationId, status: row.reservationStatus },
        'payment.failed for non-pending reservation',
      );
      return { status: 'orphaned' as const };
    }

    await tx
      .update(payments)
      .set({ status: 'failed', razorpayPaymentId })
      .where(eq(payments.id, row.paymentId));

    await tx
      .update(reservations)
      .set({ status: 'failed' })
      .where(eq(reservations.id, row.reservationId));

    const releasedSeats = await tx
      .update(seats)
      .set({
        status: 'available',
        heldBy: null,
        heldUntil: null,
        version: sql`${seats.version} + 1`,
      })
      .where(
        inArray(
          seats.id,
          tx
            .select({ id: reservationSeats.seatId })
            .from(reservationSeats)
            .where(eq(reservationSeats.reservationId, row.reservationId)),
        ),
      )
      .returning({ id: seats.id, eventId: seats.eventId });

    for (const s of releasedSeats) {
      broadcast(s.eventId, { seatId: s.id, status: 'available' });
    }

    log.info(
      { eventId: event.id, reservationId: row.reservationId },
      'payment.failed processed',
    );
    return { status: 'processed' as const };
  });
};
