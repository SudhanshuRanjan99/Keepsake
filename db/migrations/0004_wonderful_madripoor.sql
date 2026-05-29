ALTER TABLE "memories" ADD COLUMN "telegram_update_id" bigint;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_telegram_update_id_unique" UNIQUE("telegram_update_id");