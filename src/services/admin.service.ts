import { db } from '../db/index.js';
import { events } from '../db/schema/events.schema.js';
import { seats } from '../db/schema/seats.schema.js';
import { desc, eq, sql } from 'drizzle-orm';

export interface CreateEventInput {
  name: string;
  date: Date;
  venue: string | null;
}

export interface SeatRowSpec {
  label: string;
  count: number;
  price: number;
}

export const createEvent = async (input: CreateEventInput) => {
  const [row] = await db.insert(events).values(input).returning({
    id: events.id,
    name: events.name,
    date: events.date,
    venue: events.venue,
  });

  return row;
};

export const listAllEvents = async () => {
  return await db
    .select({
      id: events.id,
      name: events.name,
      date: events.date,
      venue: events.venue,
      seatCount: sql<number>`count(${seats.id})::int`,
    })
    .from(events)
    .leftJoin(seats, eq(seats.eventId, events.id))
    .groupBy(events.id)
    .orderBy(desc(events.date));
};

export class EventNotFoundError extends Error {
  constructor(message = 'Event Not Found') {
    super(message);
    this.name = 'EventNotFoundError';
  }
}

export const bulkCreateSeats = async (
  eventId: string,
  rows: SeatRowSpec[],
): Promise<{ created: number; skipped: number }> => {
  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.id, eventId));
  if (!event) throw new EventNotFoundError();

  const values = rows.flatMap((row) =>
    Array.from({ length: row.count }, (_, i) => ({
      eventId,
      seatNumber: `${row.label}${i + 1}`,
      price: row.price,
      status: 'available' as const,
    })),
  );
  if (values.length === 0) return { created: 0, skipped: 0 };

  const inserted = await db
    .insert(seats)
    .values(values)
    .onConflictDoNothing({ target: [seats.eventId, seats.seatNumber] })
    .returning({ id: seats.id });

  return {
    created: inserted.length,
    skipped: values.length - inserted.length,
  };
};
