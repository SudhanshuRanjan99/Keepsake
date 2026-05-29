CREATE TYPE "public"."journal_status" AS ENUM('draft', 'edited', 'final');--> statement-breakpoint
CREATE TYPE "public"."memory_source" AS ENUM('web', 'telegram', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."memory_type" AS ENUM('text', 'photo', 'voice');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'plus', 'pro');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('inactive', 'pending', 'active', 'expired');--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"journal_date" date NOT NULL,
	"ai_draft" text,
	"final_text" text,
	"status" "journal_status" DEFAULT 'draft' NOT NULL,
	"language" varchar(50) DEFAULT 'English' NOT NULL,
	"generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" "memory_source" DEFAULT 'web' NOT NULL,
	"type" "memory_type" DEFAULT 'text' NOT NULL,
	"raw_text" text,
	"transcript" text,
	"media_key" text,
	"language_detected" varchar(50),
	"memory_date" date NOT NULL,
	"is_private" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"requested_plan" "plan" NOT NULL,
	"amount" varchar(30) NOT NULL,
	"transaction_id" varchar(120),
	"screenshot_key" text,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text NOT NULL,
	"full_name" varchar(120) NOT NULL,
	"preferred_language" varchar(50) DEFAULT 'English' NOT NULL,
	"timezone" varchar(80) DEFAULT 'Asia/Kathmandu' NOT NULL,
	"whatsapp_number" varchar(30),
	"telegram_chat_id" varchar(100),
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"subscription_status" "subscription_status" DEFAULT 'inactive' NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;