-- Table is empty; rewrite as RENAME COLUMN to preserve the PRIMARY KEY
-- constraint. Drizzle-kit's auto-generated DROP+ADD can't ADD a PRIMARY KEY
-- column while the table still has an existing PK.
ALTER TABLE "processed_webhook_events" RENAME COLUMN "stripe_event_id" TO "razorpay_event_id";
