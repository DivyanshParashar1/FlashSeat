import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { seatStatusEnum } from './enums.schema.js';
import { events } from './events.schema.js';
import { users } from './users.schema.js';

export const seats = pgTable(
  'seats',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      // COMPOSITION: a seat has no meaning without its event. If an admin
      // deletes an event, its seats should disappear with it. (Note: this
      // cascade is BLOCKED in practice if any seat has a booking — see the
      // `restrict` on bookings.seatId below. That's intentional: you can't
      // nuke an event that people have already paid into.)
      .references(() => events.id, { onDelete: 'cascade' })
      .notNull(),
    seatNumber: varchar('seat_number', { length: 10 }).notNull(),
    status: seatStatusEnum('status').default('available').notNull(),
    price: integer('price').notNull(),
    // NULLABLE SOFT POINTER: `held_by` is just "who currently holds this seat".
    // If that user is deleted while holding a seat, we don't want to lose the
    // seat — we want to release the hold. set null does exactly that. (Only
    // valid because the column is nullable.)
    heldBy: uuid('held_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    heldUntil: timestamp('held_until', { withTimezone: true }),
    version: integer('version').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => {
    return {
      eventIdStatusIdx: index('event_id_status_idx').on(
        table.eventId,
        table.status,
      ),
      heldUntilIdx: index('held_until_idx').on(table.heldUntil),
    };
  },
);
