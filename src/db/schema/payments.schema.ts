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
    .references(() => reservations.id, { onDelete: 'restrict' })
    .notNull()
    .unique(), // One payment attempt per reservation; checkout idempotent by construction
  amount: integer('amount').notNull(), // paise (INR)
  razorpayOrderId: varchar('razorpay_order_id', { length: 255 }).unique(),
  razorpayPaymentId: varchar('razorpay_payment_id', { length: 255 }), // set by webhook
  status: paymentStatusEnum('status').default('pending').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
