ALTER TABLE "memories" ADD COLUMN "media_mime_type" varchar(120);--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "media_size_bytes" integer;--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "original_file_name" varchar(255);