import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { memories, profiles } from "@/db/schema";
import { hasActiveAiPlan } from "@/lib/subscription";

type Profile = typeof profiles.$inferSelect;
type MediaType = "photo" | "voice";
type EffectivePlan = "free" | "plus" | "pro";

type AllowedQuotaResult = {
  allowed: true;
  plan: EffectivePlan;
  limit: number;
  used: number;
  remainingAfterUpload: number;
};

type BlockedQuotaResult = {
  allowed: false;
  plan: EffectivePlan;
  limit: number;
  used: number;
  code:
    | "paid-plan-required"
    | "monthly-photo-limit"
    | "monthly-voice-limit"
    | "monthly-transcription-minutes-limit";
  message: string;
};

export type MediaQuotaResult = AllowedQuotaResult | BlockedQuotaResult;

function readPositiveInteger(name: string, fallback: number) {
  const rawValue = process.env[name];
  const parsedValue = rawValue ? Number(rawValue) : fallback;

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    return fallback;
  }

  return parsedValue;
}

function getEffectivePlan(profile: Profile): EffectivePlan {
  if (!hasActiveAiPlan(profile)) {
    return "free";
  }

  if (profile.plan === "pro") {
    return "pro";
  }

  if (profile.plan === "plus") {
    return "plus";
  }

  return "free";
}

function getMonthlyMediaCountLimit(plan: EffectivePlan, mediaType: MediaType) {
  if (plan === "free") {
    return 0;
  }

  if (plan === "plus" && mediaType === "photo") {
    return readPositiveInteger("PLUS_PHOTO_LIMIT_MONTHLY", 100);
  }

  if (plan === "plus" && mediaType === "voice") {
    return readPositiveInteger("PLUS_VOICE_LIMIT_MONTHLY", 60);
  }

  if (plan === "pro" && mediaType === "photo") {
    return readPositiveInteger("PRO_PHOTO_LIMIT_MONTHLY", 500);
  }

  return readPositiveInteger("PRO_VOICE_LIMIT_MONTHLY", 300);
}

function getMonthlyTranscriptionSecondsLimit(plan: EffectivePlan) {
  if (plan === "free") {
    return 0;
  }

  if (plan === "plus") {
    return readPositiveInteger("PLUS_TRANSCRIPTION_MINUTES_MONTHLY", 120) * 60;
  }

  return readPositiveInteger("PRO_TRANSCRIPTION_MINUTES_MONTHLY", 600) * 60;
}

function getCurrentLocalMonthRange(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const yearValue = parts.find((part) => part.type === "year")?.value;
  const monthValue = parts.find((part) => part.type === "month")?.value;

  if (!yearValue || !monthValue) {
    throw new Error("Could not calculate monthly media quota range.");
  }

  const year = Number(yearValue);
  const month = Number(monthValue);

  const monthStart = `${yearValue}-${monthValue}-01`;

  const nextMonthStart =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  return {
    monthStart,
    nextMonthStart,
  };
}

export async function checkMediaUploadQuota({
  profile,
  mediaType,
}: {
  profile: Profile;
  mediaType: MediaType;
}): Promise<MediaQuotaResult> {
  const plan = getEffectivePlan(profile);
  const limit = getMonthlyMediaCountLimit(plan, mediaType);

  if (plan === "free") {
    return {
      allowed: false,
      plan,
      limit: 0,
      used: 0,
      code: "paid-plan-required",
      message:
        mediaType === "photo"
          ? "Photo uploads require an active Plus or Pro plan."
          : "Voice-note uploads require an active Plus or Pro plan.",
    };
  }

  const { monthStart, nextMonthStart } = getCurrentLocalMonthRange(
    profile.timezone,
  );

  const used = await db.$count(
    memories,
    and(
      eq(memories.userId, profile.id),
      eq(memories.type, mediaType),
      gte(memories.memoryDate, monthStart),
      lt(memories.memoryDate, nextMonthStart),
    ),
  );

  if (used >= limit) {
    return {
      allowed: false,
      plan,
      limit,
      used,
      code:
        mediaType === "photo"
          ? "monthly-photo-limit"
          : "monthly-voice-limit",
      message:
        mediaType === "photo"
          ? `You have reached your monthly photo limit of ${limit}.`
          : `You have reached your monthly voice-note limit of ${limit}.`,
    };
  }

  return {
    allowed: true,
    plan,
    limit,
    used,
    remainingAfterUpload: limit - used - 1,
  };
}

export async function checkTranscriptionDurationQuota({
  profile,
  durationSeconds,
}: {
  profile: Profile;
  durationSeconds: number;
}): Promise<MediaQuotaResult> {
  const plan = getEffectivePlan(profile);
  const limit = getMonthlyTranscriptionSecondsLimit(plan);

  if (plan === "free") {
    return {
      allowed: false,
      plan,
      limit: 0,
      used: 0,
      code: "paid-plan-required",
      message: "Voice transcription requires an active Plus or Pro plan.",
    };
  }

  const safeDurationSeconds = Math.max(0, Math.ceil(durationSeconds));

  const { monthStart, nextMonthStart } = getCurrentLocalMonthRange(
    profile.timezone,
  );

  const rows = await db
    .select({
      used: sql<number>`coalesce(sum(${memories.transcribedDurationSeconds}), 0)`,
    })
    .from(memories)
    .where(
      and(
        eq(memories.userId, profile.id),
        eq(memories.type, "voice"),
        gte(memories.memoryDate, monthStart),
        lt(memories.memoryDate, nextMonthStart),
      ),
    );

  const used = Number(rows[0]?.used ?? 0);

  if (used + safeDurationSeconds > limit) {
    return {
      allowed: false,
      plan,
      limit,
      used,
      code: "monthly-transcription-minutes-limit",
      message: `This voice note would exceed your monthly transcription limit of ${Math.floor(
        limit / 60,
      )} minutes. You have ${Math.max(
        0,
        Math.floor((limit - used) / 60),
      )} minutes remaining.`,
    };
  }

  return {
    allowed: true,
    plan,
    limit,
    used,
    remainingAfterUpload: limit - used - safeDurationSeconds,
  };
}