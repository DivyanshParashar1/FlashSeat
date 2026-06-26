import { pgTable, uuid, timestamp } from 'drizzle-orm/pg-core';
import { reservations } from './reservations.schema.js';
import { users } from './users.schema.js';
import { seats } from './seats.schema.js';

export const bookings = pgTable('bookings', {
  id: uuid('id').defaultRandom().notNull().primaryKey(),
  reservationId: uuid('reservation_id')
    .references(() => reservations.id)
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  seatId: uuid('seat_id')
    .references(() => seats.id)
    .notNull(),
  bookedAt: timestamp('booked_at', { mode: 'string' }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
