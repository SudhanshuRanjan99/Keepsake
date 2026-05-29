ALTER TABLE "payments" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "subscription_ends_at" timestamp with time zone;