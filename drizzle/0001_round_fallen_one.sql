CREATE TYPE "public"."paymentStatus" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"seat_id" uuid NOT NULL,
	"booked_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservation_seats" (
	"reservation_id" uuid NOT NULL,
	"seat_id" uuid NOT NULL,
	CONSTRAINT "reservation_seats_reservation_id_seat_id_pk" PRIMARY KEY("reservation_id","seat_id")
);
--> statement-breakpoint
CREATE TABLE "processed_webhook_events" (
	"stripe_event_id" varchar(255) PRIMARY KEY NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "idempotency_key" varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "status" "paymentStatus" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_seat_id_seats_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."seats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_seats" ADD CONSTRAINT "reservation_seats_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_seats" ADD CONSTRAINT "reservation_seats_seat_id_seats_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."seats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "held_until_idx" ON "seats" USING btree ("held_until");--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_idempotency_key_unique" UNIQUE("idempotency_key");