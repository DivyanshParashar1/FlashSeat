import { pgTable, uuid, timestamp, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.schema.js';
import { reservationStatusEnum } from './enums.schema.js';

export const reservations = pgTable('reservations', {
  id: uuid('id').defaultRandom().primaryKey(),
  idempotencyKey: varchar('idempotency_key', { length: 128 })
    .unique()
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  status: reservationStatusEnum('status').default('pending').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
