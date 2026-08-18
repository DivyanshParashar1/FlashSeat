import { db } from '../db/index.js';
import { seats } from '../db/schema/seats.schema.js';
import { reservations } from '../db/schema/reservations.schema.js';
import { reservationSeats } from '../db/schema/reservation_seats.schema.js';
import { and, eq, inArray, sql } from 'drizzle-orm';

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

export const createReservation = async (
  input: CreateReservationInput,
): Promise<ReservationResult> => {
  const { eventId, userId, seatIds, idempotencyKey } = input;

  const existing = await findByIdempotencyKey(idempotencyKey, userId);
  if (existing) return replay(existing, seatIds);

  try {
    return await db.transaction(async (tx) => {
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

      if (!rows.every((r) => r.isGrabbable)) throw new SeatsUnavailableError();
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
        .returning({ id: reservations.id, expiresAt: reservations.expiresAt });
      const reservation = inserted[0];
      if (!reservation) throw new Error('Insert ... Returning produced no row');
      await tx
        .insert(reservationSeats)
        .values(
          seatIds.map((seatId) => ({ reservationId: reservation.id, seatId })),
        );

      return {
        reservationId: reservation.id,
        heldUntil: reservation.expiresAt,
        replayed: false,
      };
    });
  } catch (err) {
    if (isUniqueViolation(err, HOLD_CONSTRAINT)) {
      const winner = await findByIdempotencyKey(idempotencyKey, userId);
      if (winner) return replay(winner, seatIds);
    }
    throw err;
  }
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
