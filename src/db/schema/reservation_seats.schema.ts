import { pgTable, uuid, primaryKey } from 'drizzle-orm/pg-core';
import { reservations } from './reservations.schema.js';
import { seatsTable } from './seats.schema.js';

export const reservationSeats = pgTable(
  'reservation_seats',
  {
    reservationId: uuid('reservation_id')
      .references(() => reservations.id)
      .notNull(),
    seatId: uuid('seat_id')
      .references(() => seatsTable.id)
      .notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.reservationId, table.seatId] }),
    };
  },
);
