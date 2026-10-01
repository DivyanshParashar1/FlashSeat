import { db } from '../db/index.js';
import { bookings } from '../db/schema/bookings.schema.js';
import { seats } from '../db/schema/seats.schema.js';
import { events } from '../db/schema/events.schema.js';
import { desc, eq } from 'drizzle-orm';

export interface BookingRow {
  bookingId: string;
  createdAt: Date;
  event: { id: string; name: string; date: Date; venue: string | null };
  seat: { id: string; seatNumber: string; price: number };
}

export const listBookingsForUser = async (
  userId: string,
): Promise<BookingRow[]> => {
  const rows = await db
    .select({
      bookingId: bookings.id,
      createdAt: bookings.createdAt,
      eventId: events.id,
      eventName: events.name,
      eventDate: events.date,
      eventVenue: events.venue,
      seatId: seats.id,
      seatNumber: seats.seatNumber,
      seatPrice: seats.price,
    })
    .from(bookings)
    .innerJoin(seats, eq(seats.id, bookings.seatId))
    .innerJoin(events, eq(events.id, seats.eventId))
    .where(eq(bookings.userId, userId))
    .orderBy(desc(bookings.createdAt));

  return rows.map((r) => ({
    bookingId: r.bookingId,
    createdAt: r.createdAt,
    event: {
      id: r.eventId,
      name: r.eventName,
      date: r.eventDate,
      venue: r.eventVenue,
    },
    seat: {
      id: r.seatId,
      seatNumber: r.seatNumber,
      price: r.seatPrice,
    },
  }));
};
