import { db } from '../db/index.js';
import { seats } from '../db/schema/seats.schema.js';
import { reservations } from '../db/schema/reservations.schema.js';
import { reservationSeats } from '../db/schema/reservation_seats.schema.js';
import { and, eq, inArray, sql, lt, or } from 'drizzle-orm';
import { broadcast } from './seat_updates.service.js';

const HOLD_CONSTRAINT = 'reservations_user_idempotency_key_unique';

const isUniqueViolation = (err: unknown, constraint: string): boolean => {
  for (let e: unknown = err; e != null; e = (e as { cause?: unknown }).cause) {
    if (typeof e !== 'object') continue;
    const pg = e as {
      code?: string;
      constraint?: string;
    };
    if (pg.code === '23505' && pg.constraint === constraint) return true;
  }
  return false;
};

export class SeatsNotFoundError extends Error {
  constructor(message = 'One or more seats do not exist for this event') {
    super(message);
    this.name = 'SeatsNotFoundError';
  }
}

export class SeatsUnavailableError extends Error {
  constructor(message = 'One or more seats are no longer available') {
    super(message);
    this.name = 'SeatsUnavailableError';
  }
}

export class IdempotencyKeyReuseError extends Error {
  constructor(
    message = 'This idempotency key was already used with different seats',
  ) {
    super(message);
    this.name = 'IdempotencyKeyReuseError';
  }
}

export interface CreateReservationInput {
  eventId: string;
  userId: string;
  seatIds: string[];
  idempotencyKey: string;
}

export interface ReservationResult {
  reservationId: string;
  heldUntil: Date;
  replayed: boolean;
}

const createReservationPessimistic = async (
  input: CreateReservationInput,
): Promise<ReservationResult> => {
  const { eventId, userId, seatIds, idempotencyKey } = input;

  const existing = await findByIdempotencyKey(idempotencyKey, userId);
  if (existing) return replay(existing, seatIds);

  try {
    return await db
      .transaction(async (tx) => {
        const holdExpiry = sql`now() + interval '8 minutes'`;

        const rows = await tx
          .select({
            id: seats.id,
            isGrabbable: sql<boolean>`
                case
                when (${seats.status} = 'held' and ${seats.heldUntil} < now()) or ${seats.status} = 'available' 
                then true
                else false
                end`,
          })
          .from(seats)
          .where(and(eq(seats.eventId, eventId), inArray(seats.id, seatIds)))
          .orderBy(seats.id)
          .for('update');

        if (rows.length !== seatIds.length) {
          throw new SeatsNotFoundError();
        }

        if (!rows.every((r) => r.isGrabbable))
          throw new SeatsUnavailableError();
        await tx
          .update(seats)
          .set({
            status: 'held',
            heldBy: userId,
            heldUntil: holdExpiry,
            version: sql`${seats.version} + 1`,
          })
          .where(inArray(seats.id, seatIds));

        const inserted = await tx
          .insert(reservations)
          .values({
            userId,
            eventId,
            status: 'pending',
            expiresAt: holdExpiry,
            idempotencyKey,
          })
          .returning({
            id: reservations.id,
            expiresAt: reservations.expiresAt,
          });
        const reservation = inserted[0];
        if (!reservation)
          throw new Error('Insert ... Returning produced no row');
        await tx
          .insert(reservationSeats)
          .values(
            seatIds.map((seatId) => ({
              reservationId: reservation.id,
              seatId,
            })),
          );

        return {
          reservationId: reservation.id,
          heldUntil: reservation.expiresAt,
          replayed: false,
        };
      })
      .then((result) => {
        for (const seatId of seatIds)
          broadcast(eventId, { seatId, status: 'held' });
        return result;
      });
  } catch (err) {
    if (isUniqueViolation(err, HOLD_CONSTRAINT)) {
      const winner = await findByIdempotencyKey(idempotencyKey, userId);
      if (winner) return replay(winner, seatIds);
    }
    throw err;
  }
};

const createReservationOptimistic = async (
  input: CreateReservationInput,
): Promise<ReservationResult> => {
  const { eventId, userId, seatIds, idempotencyKey } = input;

  const existing = await findByIdempotencyKey(idempotencyKey, userId);
  if (existing) return replay(existing, seatIds);

  try {
    return await db
      .transaction(async (tx) => {
        const holdExpiry = sql`now() + interval '8 minutes'`;

        const grabbed = await tx
          .update(seats)
          .set({
            status: 'held',
            heldBy: userId,
            heldUntil: holdExpiry,
            version: sql`${seats.version} + 1`,
          })
          .where(
            and(
              eq(seats.eventId, eventId),
              inArray(seats.id, seatIds),
              or(
                eq(seats.status, 'available'),
                and(eq(seats.status, 'held'), lt(seats.heldUntil, sql`now()`)),
              ),
            ),
          )
          .returning({ id: seats.id });

        if (grabbed.length !== seatIds.length) {
          const found = await tx
            .select({ id: seats.id })
            .from(seats)
            .where(and(eq(seats.eventId, eventId), inArray(seats.id, seatIds)));

          if (found.length !== seatIds.length) throw new SeatsNotFoundError();
          throw new SeatsUnavailableError();
        }

        const inserted = await tx
          .insert(reservations)
          .values({
            userId,
            eventId,
            status: 'pending',
            expiresAt: holdExpiry,
            idempotencyKey,
          })
          .returning({
            id: reservations.id,
            expiresAt: reservations.expiresAt,
          });

        const reservation = inserted[0];
        if (!reservation)
          throw new Error('Insert ... Returning produced no row');

        await tx
          .insert(reservationSeats)
          .values(
            seatIds.map((seatId) => ({
              reservationId: reservation.id,
              seatId,
            })),
          );

        return {
          reservationId: reservation.id,
          heldUntil: reservation.expiresAt,
          replayed: false,
        };
      })
      .then((result) => {
        for (const seatId of seatIds)
          broadcast(eventId, { seatId, status: 'held' });
        return result;
      });
  } catch (err) {
    if (isUniqueViolation(err, HOLD_CONSTRAINT)) {
      const winner = await findByIdempotencyKey(idempotencyKey, userId);
      if (winner) return replay(winner, seatIds);
    }
    throw err;
  }
};

export const createReservation = (
  input: CreateReservationInput,
  strategy: 'pessimistic' | 'optimistic',
): Promise<ReservationResult> => {
  return strategy === 'optimistic'
    ? createReservationOptimistic(input)
    : createReservationPessimistic(input);
};

interface ExistingReservation {
  reservationId: string;
  heldUntil: Date;
  seatIds: string[];
}

/** Same key + same seats = a genuine retry. Same key + different seats = a
 *  client bug or key collision, and must not silently return the old hold. */
const replay = (
  existing: ExistingReservation,
  requestedSeatIds: string[],
): ReservationResult => {
  const a = [...existing.seatIds].sort().join(',');
  const b = [...requestedSeatIds].sort().join(',');
  if (a !== b) throw new IdempotencyKeyReuseError();

  return {
    reservationId: existing.reservationId,
    heldUntil: existing.heldUntil,
    replayed: true,
  };
};

const findByIdempotencyKey = async (
  idempotencyKey: string,
  userId: string,
): Promise<ExistingReservation | null> => {
  const result = await db
    .select({
      reservationId: reservations.id,
      heldUntil: reservations.expiresAt,
      seatIds: sql<string[]>`array_agg(${reservationSeats.seatId}::text)`,
    })
    .from(reservations)
    .innerJoin(
      reservationSeats,
      eq(reservationSeats.reservationId, reservations.id),
    )
    .where(
      and(
        eq(reservations.userId, userId),
        eq(reservations.idempotencyKey, idempotencyKey),
      ),
    )
    .groupBy(reservations.id)
    .limit(1);

  const row = result[0];
  if (!row) return null;
  return {
    reservationId: row.reservationId,
    heldUntil: row.heldUntil,
    seatIds: row.seatIds,
  };
};
export class ReservationNotFoundError extends Error {
  constructor(message = 'Reservation not found') {
    super(message);
    this.name = 'ReservationNotFoundError';
  }
}

export class ReservationNotReleasableError extends Error {
  constructor(
    message = 'Reservation cannot be released — it is already confirmed',
  ) {
    super(message);
    this.name = 'ReservationNotReleasableError';
  }
}

export interface ReleaseReservationInput {
  reservationId: string;
  userId: string;
}

export const releaseReservation = async (
  input: ReleaseReservationInput,
): Promise<{ released: boolean }> => {
  const { reservationId, userId } = input;

  return await db.transaction(async (tx) => {
    // Lock the reservation row to prevent races with checkout/sweeper.
    const rows = await tx
      .select({
        id: reservations.id,
        userId: reservations.userId,
        status: reservations.status,
      })
      .from(reservations)
      .where(eq(reservations.id, reservationId))
      .for('update');

    const reservation = rows[0];
    // Not found OR not owned by this user → same response (don't leak existence).
    if (!reservation || reservation.userId !== userId) {
      throw new ReservationNotFoundError();
    }

    // Idempotent: already terminal → 204 with released=false.
    // Note: reservation status enum has no 'cancelled' — user-cancelled and
    // sweeper-expired both collapse to 'expired'. Documented in interview_prep.
    if (reservation.status === 'expired' || reservation.status === 'failed') {
      return { released: false };
    }

    // Paid → cannot release via this endpoint.
    if (reservation.status === 'confirmed') {
      throw new ReservationNotReleasableError();
    }

    await tx
      .update(reservations)
      .set({ status: 'expired' })
      .where(eq(reservations.id, reservationId));

    const released = await tx
      .update(seats)
      .set({
        status: 'available',
        heldBy: null,
        heldUntil: null,
        version: sql`${seats.version} + 1`,
      })
      .where(
        and(
          eq(seats.heldBy, userId),
          inArray(
            seats.id,
            tx
              .select({ id: reservationSeats.seatId })
              .from(reservationSeats)
              .where(eq(reservationSeats.reservationId, reservationId)),
          ),
        ),
      )
      .returning({ id: seats.id, eventId: seats.eventId });

    for (const seat of released) {
      broadcast(seat.eventId, { seatId: seat.id, status: 'available' });
    }

    return { released: true };
  });
};
