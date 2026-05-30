"use server";

import { db } from "@/db";
import { memories, profiles } from "@/db/schema";
import { getRequiredProfile } from "@/lib/current-profile";
import { deletePrivateObject } from "@/lib/r2";
import { and, eq } from "drizzle-orm";
import { checkMediaUploadQuota } from "@/lib/media-quotas";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { enqueueVoiceTranscriptionForPaidUser } from "@/lib/voice-transcription";
import { hasActiveAiPlan } from "@/lib/subscription";

const memoryTextSchema = z.object({
  rawText: z
    .string()
    .trim()
    .min(1, "Write something before saving.")
    .max(4000, "A single memory must be under 4,000 characters."),
});

const memoryUpdateSchema = z.object({
  memoryId: z.string().uuid("Invalid memory ID."),
  rawText: z
    .string()
    .trim()
    .min(1, "A memory cannot be empty.")
    .max(4000, "A single memory must be under 4,000 characters."),
});

const memoryDeleteSchema = z.object({
  memoryId: z.string().uuid("Invalid memory ID."),
});

function getDateInTimezone(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function createMemoryAction(formData: FormData) {
  const { profile } = await getRequiredProfile();

  const validation = memoryTextSchema.safeParse({
    rawText: formData.get("rawText"),
  });

  if (!validation.success) {
    throw new Error(validation.error.issues[0]?.message ?? "Invalid memory.");
  }

  await db.insert(memories).values({
    userId: profile.id,
    source: "web",
    type: "text",
    rawText: validation.data.rawText,
    memoryDate: getDateInTimezone(profile.timezone),
    isPrivate: true,
  });

  await db
    .update(profiles)
    .set({
      lastActiveAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, profile.id));

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/memories");
}

export async function updateMemoryAction(formData: FormData) {
  const { profile } = await getRequiredProfile();

  const validation = memoryUpdateSchema.safeParse({
    memoryId: formData.get("memoryId"),
    rawText: formData.get("rawText"),
  });

  if (!validation.success) {
    throw new Error(
      validation.error.issues[0]?.message ?? "Could not update memory.",
    );
  }

  await db
    .update(memories)
    .set({
      rawText: validation.data.rawText,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(memories.id, validation.data.memoryId),
        eq(memories.userId, profile.id),
        eq(memories.type, "text"),
      ),
    );

  await db
    .update(profiles)
    .set({
      lastActiveAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, profile.id));

  revalidatePath("/dashboard/memories");
}

export async function deleteMemoryAction(formData: FormData) {
  const { profile } = await getRequiredProfile();

  const validation = memoryDeleteSchema.safeParse({
    memoryId: formData.get("memoryId"),
  });

  if (!validation.success) {
    throw new Error("Memory ID is invalid.");
  }

  const ownedMemories = await db
    .select({
      id: memories.id,
      mediaKey: memories.mediaKey,
    })
    .from(memories)
    .where(
      and(
        eq(memories.id, validation.data.memoryId),
        eq(memories.userId, profile.id),
      ),
    )
    .limit(1);

  const ownedMemory = ownedMemories[0];

  if (!ownedMemory) {
    return;
  }

  if (ownedMemory.mediaKey) {
    await deletePrivateObject(ownedMemory.mediaKey);
  }

  await db
    .delete(memories)
    .where(
      and(
        eq(memories.id, ownedMemory.id),
        eq(memories.userId, profile.id),
      ),
    );

  await db
    .update(profiles)
    .set({
      lastActiveAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, profile.id));

  revalidatePath("/dashboard/memories");
}

export async function queueVoiceTranscriptionAction(formData: FormData) {
  const { profile } = await getRequiredProfile();

  if (!hasActiveAiPlan(profile)) {
    throw new Error(
      "Voice transcription requires an active Plus or Pro subscription.",
    );
  }

  const memoryId = formData.get("memoryId");

  if (typeof memoryId !== "string") {
    throw new Error("Memory ID is missing.");
  }

  await enqueueVoiceTranscriptionForPaidUser({
    memoryId,
    profile,
  });

  revalidatePath("/dashboard/memories");
}