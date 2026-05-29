ALTER TABLE "journal_entries" ADD COLUMN "telegram_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "automatic_journals_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "journal_hour_local" integer DEFAULT 21 NOT NULL;