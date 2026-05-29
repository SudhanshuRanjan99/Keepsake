import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { journalEntries, memories, profiles } from "@/db/schema";
import { queueDailyJournal } from "@/lib/jobs";
import { hasActiveAiPlan } from "@/lib/subscription";

function getLocalDateAndHour(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
  };
}

export async function scheduleNightlyJournals() {
  const candidateProfiles = await db
    .select()
    .from(profiles)
    .where(eq(profiles.subscriptionStatus, "active"));

  for (const profile of candidateProfiles) {
    if (!profile.automaticJournalsEnabled) {
      continue;
    }

    if (!hasActiveAiPlan(profile)) {
      continue;
    }

    const localTime = getLocalDateAndHour(profile.timezone);

    if (localTime.hour < profile.journalHourLocal) {
      continue;
    }

    const todaysMemories = await db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.userId, profile.id),
          eq(memories.memoryDate, localTime.date),
        ),
      );

    if (todaysMemories.length === 0) {
      continue;
    }

    const waitingForVoiceTranscript = todaysMemories.some(
      (memory) => memory.type === "voice" && !memory.transcript,
    );

    if (waitingForVoiceTranscript) {
      continue;
    }

    const hasUsableSource = todaysMemories.some((memory) => {
      if (memory.type === "text") {
        return Boolean(memory.rawText?.trim());
      }

      if (memory.type === "photo") {
        return Boolean(memory.rawText?.trim());
      }

      if (memory.type === "voice") {
        return Boolean(memory.transcript?.trim());
      }

      return false;
    });

    if (!hasUsableSource) {
      continue;
    }

    const createdEntries = await db
      .insert(journalEntries)
      .values({
        userId: profile.id,
        journalDate: localTime.date,
        language: profile.preferredLanguage,
        generationStatus: "queued",
      })
      .onConflictDoNothing({
        target: [journalEntries.userId, journalEntries.journalDate],
      })
      .returning({
        id: journalEntries.id,
      });

    const createdEntry = createdEntries[0];

    if (!createdEntry) {
      continue;
    }

    try {
      await queueDailyJournal(createdEntry.id);

      console.log(
        `Queued nightly journal ${createdEntry.id} for user ${profile.id}`,
      );
    } catch (error) {
      await db
        .update(journalEntries)
        .set({
          generationStatus: "failed",
          generationError: "Could not queue automatic journal generation.",
          updatedAt: new Date(),
        })
        .where(eq(journalEntries.id, createdEntry.id));

      console.error(
        `Could not queue nightly journal for user ${profile.id}:`,
        error,
      );
    }
  }
}