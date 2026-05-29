CREATE TABLE "telegram_onboarding_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" varchar(100) NOT NULL,
	"telegram_username" varchar(100),
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_onboarding_tokens_token_hash_unique" UNIQUE("token_hash")
);
