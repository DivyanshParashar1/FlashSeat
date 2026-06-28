import { pgTable, varchar, timestamp } from 'drizzle-orm/pg-core';

export const processed_webhook_events = pgTable('processed_webhook_events', {
  stripeEventId: varchar('stripe_event_id', { length: 255 })
    .notNull()
    .primaryKey(),
  processedAt: timestamp('processed_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
