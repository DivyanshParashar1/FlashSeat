import {
  pgTable,
  uuid,
  integer,
  varchar,
  timestamp,
} from 'drizzle-orm/pg-core';
import { reservations } from './reservations.schema.js';

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  reservationId: uuid('reservation_id')
    .references(() => reservations.id)
    .notNull(),
  amount: integer('amount').notNull(), // In cents
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  idempotencyKey: varchar('idempotency_key', { length: 255 })
    .notNull()
    .unique(), // CRITICAL for webhook safety
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
