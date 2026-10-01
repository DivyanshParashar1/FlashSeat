import { db } from '../db/index.js';
import { seats } from '../db/schema/seats.schema.js';
import { reservations } from '../db/schema/reservations.schema.js';
import { and, eq, lt, sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';

export interface SweepResult {
  seatsFreed: number;
  reservationsExpired: number;
  durationMs: number;
}

export const sweepExpiredHolds = async (): Promise<SweepResult> => {
  const start = Date.now();
  return await db.transaction(async (tx) => {
    const freedSeats = await tx
      .update(seats)
      .set({
        status: 'available',
        heldBy: null,
        heldUntil: null,
        version: sql`${seats.version} + 1`,
      })
      .where(and(eq(seats.status, 'held'), lt(seats.heldUntil, sql`now()`)))
      .returning({ id: seats.id });

    const expiredReservations = await tx
      .update(reservations)
      .set({
        status: 'expired',
      })
      .where(
        and(
          eq(reservations.status, 'pending'),
          lt(reservations.expiresAt, sql`now()`),
        ),
      )
      .returning({ id: reservations.id });

    return {
      seatsFreed: freedSeats.length,
      reservationsExpired: expiredReservations.length,
      durationMs: Date.now() - start,
    };
  });
};

export const startSweeper = (
  intervalMs: number,
  logger: FastifyBaseLogger,
): { stop: () => void } => {
  if (intervalMs <= 0) {
    logger.info('sweeper disabled (SWEEPER_INTERVAL_MS=0)');
    return { stop: () => {} };
  }
  logger.info({ intervalMs }, 'sweeper starting');
  const tick = async () => {
    try {
      const result = await sweepExpiredHolds();
      if (result.seatsFreed > 0 || result.reservationsExpired > 0) {
        logger.info(result, 'sweeper tick - rows swept');
      } else {
        logger.debug(result, 'sweeper tick - nothing to sweep');
      }
    } catch (err) {
      logger.error({ err }, 'sweeper tick failed');
    }
  };
  const handle = setInterval(tick, intervalMs);
  handle.unref();

  return {
    stop: () => {
      clearInterval(handle);
      logger.info('sweeper stopped');
    },
  };
};
