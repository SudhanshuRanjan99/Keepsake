import OpenAI from "openai";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sendTelegramMessage } from "@/lib/telegram";
import {
  journalEntries,
  journalMemoryLinks,
  memories,
  profiles,
} from "@/db/schema";
import { hasActiveAiPlan } from "@/lib/subscription";

function getOpenAiClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not defined.");
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

function getJournalModel() {
  return process.env.JOURNAL_MODEL || "gpt-5.4-mini";
}

function createSourceText(
  sourceMemories: Array<typeof memories.$inferSelect>,
) {
  const fragments = sourceMemories
    .map((memory, index) => {
      if (memory.type === "text" && memory.rawText) {
        return `[Fragment ${index + 1} — written message]\n${memory.rawText}`;
      }

      if (memory.type === "photo" && memory.rawText) {
        return `[Fragment ${index + 1} — photo caption]\n${memory.rawText}`;
      }

      if (memory.type === "voice" && memory.transcript) {
        return `[Fragment ${index + 1} — voice-note transcript]\n${memory.transcript}`;
      }

      return null;
    })
    .filter((fragment): fragment is string => Boolean(fragment));

  return fragments.join("\n\n");
}

export async function generateDailyJournal(journalId: string) {
  const selectedEntries = await db
    .select({
      journal: journalEntries,
      profile: profiles,
    })
    .from(journalEntries)
    .innerJoin(profiles, eq(journalEntries.userId, profiles.id))
    .where(eq(journalEntries.id, journalId))
    .limit(1);

  const selected = selectedEntries[0];

  if (!selected) {
    return;
  }

  const { journal, profile } = selected;

  if (!hasActiveAiPlan(profile)) {
    await db
      .update(journalEntries)
      .set({
        generationStatus: "failed",
        generationError: "Active Plus or Pro subscription required.",
        updatedAt: new Date(),
      })
      .where(eq(journalEntries.id, journal.id));

    return;
  }

  await db
    .update(journalEntries)
    .set({
      generationStatus: "processing",
      generationError: null,
      updatedAt: new Date(),
    })
    .where(eq(journalEntries.id, journal.id));

  try {
    const sourceMemories = await db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.userId, profile.id),
          eq(memories.memoryDate, journal.journalDate),
        ),
      )
      .orderBy(asc(memories.createdAt));

    const incompleteVoiceNotes = sourceMemories.filter(
      (memory) => memory.type === "voice" && !memory.transcript,
    );

    if (incompleteVoiceNotes.length > 0) {
      throw new Error(
        "One or more voice notes do not have transcripts yet.",
      );
    }

    const sourceText = createSourceText(sourceMemories);

    if (!sourceText.trim()) {
      throw new Error("No written fragments are available for this journal.");
    }

    const openai = getOpenAiClient();

    const response = await openai.responses.create({
      model: getJournalModel(),
      instructions: [
        "You write private daily journal entries for Keepsake.",
        "Write with warmth, restraint, and emotional intelligence.",
        "Never turn the entry into advice.",
        "Do not mention that you are an AI or that source fragments were supplied.",
        "Write in the user's requested journal language.",
        "Preserve names and place names exactly as written unless transliteration is clearly necessary for the requested language.",
        "Write one cohesive first-person journal entry.",
        
      ].join("\n"),
      input: [
        `Journal date: ${journal.journalDate}`,
        `Requested journal language: ${profile.preferredLanguage}`,
        "",
        "Source fragments:",
        sourceText,
      ].join("\n"),
    });

    const generatedText = response.output_text.trim();

    if (!generatedText) {
      throw new Error("OpenAI returned an empty journal entry.");
    }

    await db.transaction(async (tx) => {
      
      if (profile.telegramChatId) {
  try {
    await sendTelegramMessage(
      profile.telegramChatId,
      `Your private journal for ${journal.journalDate} is ready in Keepsake.`,
    );

    await db
      .update(journalEntries)
      .set({
        telegramNotifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(journalEntries.id, journal.id));
  } catch (notificationError) {
    console.error(
      `Journal was generated, but Telegram notification failed for journal ${journal.id}:`,
      notificationError,
    );
  }
}
      
      
      await tx
        .update(journalEntries)
        .set({
          aiDraft: generatedText,
          finalText: generatedText,
          language: profile.preferredLanguage,
          generationStatus: "completed",
          generationError: null,
          generatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(journalEntries.id, journal.id));

      await tx
        .delete(journalMemoryLinks)
        .where(eq(journalMemoryLinks.journalId, journal.id));

      if (sourceMemories.length > 0) {
        await tx.insert(journalMemoryLinks).values(
          sourceMemories.map((memory) => ({
            journalId: journal.id,
            memoryId: memory.id,
          })),
        );
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown journal error.";

    await db
      .update(journalEntries)
      .set({
        generationStatus: "failed",
        generationError: message.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(journalEntries.id, journal.id));

    throw error;
  }
}