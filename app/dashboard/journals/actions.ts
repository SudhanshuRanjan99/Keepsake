"use server";

import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { journalEntries, memories } from "@/db/schema";
import { queueDailyJournal } from "@/lib/jobs";
import { getRequiredProfile } from "@/lib/current-profile";
import { hasActiveAiPlan } from "@/lib/subscription";

function getDateInTimezone(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const editJournalSchema = z.object({
  journalId: z.string().uuid("Invalid journal ID."),
  finalText: z
    .string()
    .trim()
    .min(1, "Journal entry cannot be empty.")
    .max(20000, "Journal entry is too long."),
});

export async function generateTodayJournalAction() {
  const { profile } = await getRequiredProfile();

  if (!hasActiveAiPlan(profile)) {
    redirect("/dashboard/journals?error=paid-plan-required");
  }

  const today = getDateInTimezone(profile.timezone);

  const todaysMemories = await db
    .select()
    .from(memories)
    .where(
      and(eq(memories.userId, profile.id), eq(memories.memoryDate, today)),
    )
    .orderBy(desc(memories.createdAt));

  if (todaysMemories.length === 0) {
    redirect("/dashboard/journals?error=no-memories");
  }

  const incompleteVoiceNote = todaysMemories.some(
    (memory) => memory.type === "voice" && !memory.transcript,
  );

  if (incompleteVoiceNote) {
    redirect("/dashboard/journals?error=voice-not-ready");
  }

  const usableTextExists = todaysMemories.some((memory) => {
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

  if (!usableTextExists) {
    redirect("/dashboard/journals?error=no-written-source");
  }

  const existingEntries = await db
    .select()
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.userId, profile.id),
        eq(journalEntries.journalDate, today),
      ),
    )
    .limit(1);

  const existingEntry = existingEntries[0];

  let journalId: string;

  if (existingEntry) {
    if (
      existingEntry.generationStatus === "queued" ||
      existingEntry.generationStatus === "processing"
    ) {
      redirect("/dashboard/journals?status=already-processing");
    }

    if (existingEntry.generationStatus === "completed") {
      redirect("/dashboard/journals?status=already-created");
    }

    const retriedEntries = await db
      .update(journalEntries)
      .set({
        generationStatus: "queued",
        generationError: null,
        updatedAt: new Date(),
      })
      .where(eq(journalEntries.id, existingEntry.id))
      .returning({
        id: journalEntries.id,
      });

    journalId = retriedEntries[0].id;
  } else {
    const createdEntries = await db
      .insert(journalEntries)
      .values({
        userId: profile.id,
        journalDate: today,
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
      redirect("/dashboard/journals?status=already-processing");
    }

    journalId = createdEntry.id;
  }

  try {
    await queueDailyJournal(journalId);
  } catch (error) {
    await db
      .update(journalEntries)
      .set({
        generationStatus: "failed",
        generationError: "Could not queue journal generation.",
        updatedAt: new Date(),
      })
      .where(eq(journalEntries.id, journalId));

    throw error;
  }

  revalidatePath("/dashboard/journals");

  redirect("/dashboard/journals?status=queued");
}

export async function updateJournalAction(formData: FormData) {
  const { profile } = await getRequiredProfile();

  const validation = editJournalSchema.safeParse({
    journalId: formData.get("journalId"),
    finalText: formData.get("finalText"),
  });

  if (!validation.success) {
    throw new Error(
      validation.error.issues[0]?.message ?? "Could not save journal.",
    );
  }

  await db
    .update(journalEntries)
    .set({
      finalText: validation.data.finalText,
      status: "edited",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(journalEntries.id, validation.data.journalId),
        eq(journalEntries.userId, profile.id),
        eq(journalEntries.generationStatus, "completed"),
      ),
    );

  revalidatePath("/dashboard/journals");

  redirect("/dashboard/journals?status=saved");
}