CREATE TYPE "public"."transcription_status" AS ENUM('not_requested', 'queued', 'processing', 'completed', 'failed');--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "transcription_status" "transcription_status" DEFAULT 'not_requested' NOT NULL;--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "transcription_error" text;--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "transcribed_at" timestamp with time zone;