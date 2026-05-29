import {
  bigint,
  boolean,
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const planEnum = pgEnum("plan", ["free", "plus", "pro"]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "inactive",
  "pending",
  "active",
  "expired",
]);

export const memoryTypeEnum = pgEnum("memory_type", [
  "text",
  "photo",
  "voice",
]);

export const memorySourceEnum = pgEnum("memory_source", [
  "web",
  "telegram",
  "whatsapp",
]);

export const journalGenerationStatusEnum = pgEnum(
  "journal_generation_status",
  ["queued", "processing", "completed", "failed"],
);

export const transcriptionStatusEnum = pgEnum("transcription_status", [
  "not_requested",
  "queued",
  "processing",
  "completed",
  "failed",
]);

export const journalStatusEnum = pgEnum("journal_status", [
  "draft",
  "edited",
  "final",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "approved",
  "rejected",
]);

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),

  authUserId: text("auth_user_id").notNull().unique(),

  fullName: varchar("full_name", { length: 120 }).notNull(),

  preferredLanguage: varchar("preferred_language", { length: 50 })
    .notNull()
    .default("English"),

  timezone: varchar("timezone", { length: 80 })
    .notNull()
    .default("Asia/Kathmandu"),

    automaticJournalsEnabled: boolean("automatic_journals_enabled")
  .notNull()
  .default(true),

journalHourLocal: integer("journal_hour_local")
  .notNull()
  .default(21),

  whatsappNumber: varchar("whatsapp_number", { length: 30 }),

  telegramChatId: varchar("telegram_chat_id", { length: 100 }).unique(),

  telegramUsername: varchar("telegram_username", { length: 100 }),

  telegramLinkedAt: timestamp("telegram_linked_at", {
  withTimezone: true,
  }),




  plan: planEnum("plan").notNull().default("free"),

  subscriptionStatus: subscriptionStatusEnum("subscription_status")
    .notNull()
    .default("inactive"),

    subscriptionEndsAt: timestamp("subscription_ends_at", {
    withTimezone: true,
    }),

  lastActiveAt: timestamp("last_active_at", { withTimezone: true })
    .notNull()
    .defaultNow(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const telegramLinkTokens = pgTable("telegram_link_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),

  tokenHash: text("token_hash").notNull().unique(),

  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

  usedAt: timestamp("used_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const telegramOnboardingTokens = pgTable(
  "telegram_onboarding_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    chatId: varchar("chat_id", { length: 100 }).notNull(),

    telegramUsername: varchar("telegram_username", { length: 100 }),

    tokenHash: text("token_hash").notNull().unique(),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    usedAt: timestamp("used_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const telegramProcessedUpdates = pgTable(
  "telegram_processed_updates",
  {
    updateId: bigint("update_id", { mode: "number" }).primaryKey(),

    processedAt: timestamp("processed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const memories = pgTable("memories", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),

  source: memorySourceEnum("source").notNull().default("web"),

  telegramUpdateId: bigint("telegram_update_id", {
    mode: "number",
  }).unique(),

  type: memoryTypeEnum("type").notNull().default("text"),

  rawText: text("raw_text"),

  transcript: text("transcript"),

transcriptionStatus: transcriptionStatusEnum("transcription_status")
  .notNull()
  .default("not_requested"),

transcriptionError: text("transcription_error"),

transcribedAt: timestamp("transcribed_at", {
  withTimezone: true,
}),

  mediaKey: text("media_key"),

  mediaMimeType: varchar("media_mime_type", { length: 120 }),

  mediaSizeBytes: integer("media_size_bytes"),

  originalFileName: varchar("original_file_name", { length: 255 }),

  languageDetected: varchar("language_detected", { length: 50 }),

  memoryDate: date("memory_date").notNull(),

  isPrivate: boolean("is_private").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    journalDate: date("journal_date").notNull(),

    aiDraft: text("ai_draft"),

    finalText: text("final_text"),

    status: journalStatusEnum("status").notNull().default("draft"),

    generationStatus: journalGenerationStatusEnum("generation_status")
      .notNull()
      .default("queued"),

    generationError: text("generation_error"),

    language: varchar("language", { length: 50 })
      .notNull()
      .default("English"),

    generatedAt: timestamp("generated_at", { withTimezone: true }),
    telegramNotifiedAt: timestamp("telegram_notified_at", {
  withTimezone: true,
}),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("journal_entries_user_date_unique").on(
      table.userId,
      table.journalDate,
    ),
  ],
);

export const journalMemoryLinks = pgTable(
  "journal_memory_links",
  {
    journalId: uuid("journal_id")
      .notNull()
      .references(() => journalEntries.id, { onDelete: "cascade" }),

    memoryId: uuid("memory_id")
      .notNull()
      .references(() => memories.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("journal_memory_link_unique").on(
      table.journalId,
      table.memoryId,
    ),
  ],
);

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),

  requestedPlan: planEnum("requested_plan").notNull(),

  amount: varchar("amount", { length: 30 }).notNull(),

  transactionId: varchar("transaction_id", { length: 120 }),

  screenshotKey: text("screenshot_key"),

  status: paymentStatusEnum("status").notNull().default("pending"),

reviewedBy: text("reviewed_by"),

reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

reviewNote: text("review_note"),

approvedBy: text("approved_by"),

approvedAt: timestamp("approved_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});