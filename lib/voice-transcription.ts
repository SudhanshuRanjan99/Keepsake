

import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { memories } from "@/db/schema";
import { queueVoiceTranscription } from "@/lib/jobs";
import { hasActiveAiPlan } from "@/lib/subscription";

type VoicePlanProfile = {
  id: string;
  plan: "free" | "plus" | "pro";
  subscriptionStatus: "inactive" | "pending" | "active" | "expired";
  subscriptionEndsAt: Date | null;
};

type EnqueueVoiceInput = {
  memoryId: string;
  profile: VoicePlanProfile;
};

export async function enqueueVoiceTranscriptionForPaidUser({
  memoryId,
  profile,
}: EnqueueVoiceInput) {
  if (!hasActiveAiPlan(profile)) {
    return false;
  }

  const updatedMemories = await db
    .update(memories)
    .set({
      transcriptionStatus: "queued",
      transcriptionError: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(memories.id, memoryId),
        eq(memories.userId, profile.id),
        eq(memories.type, "voice"),
        or(
          eq(memories.transcriptionStatus, "not_requested"),
          eq(memories.transcriptionStatus, "failed"),
        ),
      ),
    )
    .returning({
      id: memories.id,
    });

  const queuedMemory = updatedMemories[0];

  if (!queuedMemory) {
    return false;
  }

  try {
    await queueVoiceTranscription(queuedMemory.id);

    return true;
  } catch (error) {
    await db
      .update(memories)
      .set({
        transcriptionStatus: "failed",
        transcriptionError: "Could not queue transcription.",
        updatedAt: new Date(),
      })
      .where(eq(memories.id, queuedMemory.id));

    throw error;
  }
}