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
      .references(() => events.id)
      .notNull(),
    seatNumber: varchar('seat_number', { length: 10 }).notNull(),
    status: seatStatusEnum('status').default('available').notNull(),
    price: integer('price').notNull(),
    heldBy: uuid('held_by').references(() => users.id),
    heldUntil: timestamp('held_until', { withTimezone: true }),
    version: integer('version').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      eventIdStatusIdx: index('event_id_status_idx').on(
        table.eventId,
        table.status,
      ),
    };
  },
);
