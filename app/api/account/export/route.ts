import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  journalEntries,
  memories,
  payments,
} from "@/db/schema";
import { getRequiredProfile } from "@/lib/current-profile";

export const runtime = "nodejs";

function createExportFilename() {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return `keepsake-export-${date}.json`;
}

export async function GET() {
  const { session, profile } = await getRequiredProfile();

  const [userMemories, userJournals, userPayments] = await Promise.all([
  db
    .select()
    .from(memories)
    .where(eq(memories.userId, profile.id))
    .orderBy(asc(memories.memoryDate), asc(memories.createdAt)),

  db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.userId, profile.id))
    .orderBy(asc(journalEntries.journalDate)),

  db
    .select()
    .from(payments)
    .where(eq(payments.userId, profile.id))
    .orderBy(asc(payments.createdAt)),
]);

  const exportData = {
    exportInformation: {
      service: "Keepsake",
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      note: "This export contains text and account records. Private photo and audio file downloads are not included in this version.",
    },

    account: {
      fullName: profile.fullName,
      email: session.user.email,
      preferredLanguage: profile.preferredLanguage,
      timezone: profile.timezone,
      whatsappNumber: profile.whatsappNumber,
      telegramConnected: Boolean(profile.telegramChatId),
      telegramUsername: profile.telegramUsername,
      telegramLinkedAt: profile.telegramLinkedAt,
      plan: profile.plan,
      subscriptionStatus: profile.subscriptionStatus,
      subscriptionEndsAt: profile.subscriptionEndsAt,
      automaticJournalsEnabled: profile.automaticJournalsEnabled,
      journalHourLocal: profile.journalHourLocal,
      createdAt: profile.createdAt,
    },

    memories: userMemories.map((memory) => ({
      id: memory.id,
      source: memory.source,
      type: memory.type,
      memoryDate: memory.memoryDate,
      originalTextOrCaption: memory.rawText,
      transcript: memory.transcript,
      transcriptionStatus: memory.transcriptionStatus,
      hasPrivateMediaFile: Boolean(memory.mediaKey),
      mediaMimeType: memory.mediaMimeType,
      mediaSizeBytes: memory.mediaSizeBytes,
      originalFileName: memory.originalFileName,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
    })),

    dailyJournals: userJournals.map((journal) => ({
      id: journal.id,
      journalDate: journal.journalDate,
      language: journal.language,
      aiDraft: journal.aiDraft,
      finalText: journal.finalText,
      status: journal.status,
      generationStatus: journal.generationStatus,
      generatedAt: journal.generatedAt,
      createdAt: journal.createdAt,
      updatedAt: journal.updatedAt,
    })),

    

    payments: userPayments.map((payment) => ({
      requestedPlan: payment.requestedPlan,
      amount: payment.amount,
      transactionId: payment.transactionId,
      status: payment.status,
      reviewNote: payment.reviewNote,
      reviewedAt: payment.reviewedAt,
      createdAt: payment.createdAt,
      hasPrivatePaymentProof: Boolean(payment.screenshotKey),
    })),
  };

  return new Response(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${createExportFilename()}"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}