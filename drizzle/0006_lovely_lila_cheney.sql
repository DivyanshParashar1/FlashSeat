ALTER TABLE "payments" DROP CONSTRAINT "payments_idempotency_key_unique";--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "razorpay_order_id" varchar(255);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "razorpay_payment_id" varchar(255);--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "stripe_payment_intent_id";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "idempotency_key";--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reservation_id_unique" UNIQUE("reservation_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_razorpay_order_id_unique" UNIQUE("razorpay_order_id");