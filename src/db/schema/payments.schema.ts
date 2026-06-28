import {
  pgTable,
  uuid,
  integer,
  varchar,
  timestamp,
} from 'drizzle-orm/pg-core';
import { reservations } from './reservations.schema.js';
import { paymentStatusEnum } from './enums.schema.js';

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  reservationId: uuid('reservation_id')
    // RESTRICT: a payment is a financial record. Never let it be auto-deleted
    // as a side effect of deleting its reservation — that would erase money
    // movement from the books. Deleting the reservation is blocked while a
    // payment row points at it.
    .references(() => reservations.id, { onDelete: 'restrict' })
    .notNull(),
  amount: integer('amount').notNull(), // In cents
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  status: paymentStatusEnum('status').default('pending').notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 255 })
    .notNull()
    .unique(), // CRITICAL for webhook safety
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
