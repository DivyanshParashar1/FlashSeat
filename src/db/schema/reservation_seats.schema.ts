import { pgTable, uuid, primaryKey } from 'drizzle-orm/pg-core';
import { reservations } from './reservations.schema.js';
import { seats } from './seats.schema.js';

export const reservationSeats = pgTable(
  'reservation_seats',
  {
    reservationId: uuid('reservation_id')
      // COMPOSITION: this join row is part of the reservation aggregate. When a
      // reservation is cleaned up (e.g. an abandoned/expired hold gets deleted),
      // its seat links should go with it.
      .references(() => reservations.id, { onDelete: 'cascade' })
      .notNull(),
    seatId: uuid('seat_id')
      // COMPOSITION: this is the transient HOLD link, not a confirmed booking.
      // If a seat ever disappears (only possible when its event is deleted and
      // no bookings block it), the dangling hold link is meaningless — drop it.
      .references(() => seats.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.reservationId, table.seatId] }),
    };
  },
);
