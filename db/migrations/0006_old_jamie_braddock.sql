CREATE TYPE "public"."journal_generation_status" AS ENUM('queued', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "journal_memory_links" (
	"journal_id" uuid NOT NULL,
	"memory_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "generation_status" "journal_generation_status" DEFAULT 'queued' NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "generation_error" text;--> statement-breakpoint
ALTER TABLE "journal_memory_links" ADD CONSTRAINT "journal_memory_links_journal_id_journal_entries_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_memory_links" ADD CONSTRAINT "journal_memory_links_memory_id_memories_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."memories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "journal_memory_link_unique" ON "journal_memory_links" USING btree ("journal_id","memory_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_user_date_unique" ON "journal_entries" USING btree ("user_id","journal_date");