import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { memories, profiles } from "@/db/schema";
import { getRequiredProfile } from "@/lib/current-profile";
import { getAudioDurationSeconds } from "@/lib/audio-duration";
import {
  checkMediaUploadQuota,
  checkTranscriptionDurationQuota,
} from "@/lib/media-quotas";
import { deletePrivateObject, uploadPrivateObject } from "@/lib/r2";
import { eq } from "drizzle-orm";
import { queueVoiceTranscription } from "@/lib/jobs";

export const runtime = "nodejs";

const maximumFileSize = 10 * 1024 * 1024;

const allowedFiles = {
  "image/jpeg": {
    memoryType: "photo" as const,
    extension: "jpg",
  },
  "image/png": {
    memoryType: "photo" as const,
    extension: "png",
  },
  "image/webp": {
    memoryType: "photo" as const,
    extension: "webp",
  },
  "audio/mpeg": {
    memoryType: "voice" as const,
    extension: "mp3",
  },
  "audio/mp4": {
    memoryType: "voice" as const,
    extension: "m4a",
  },
  "audio/ogg": {
    memoryType: "voice" as const,
    extension: "ogg",
  },
  "audio/webm": {
    memoryType: "voice" as const,
    extension: "webm",
  },
  "audio/wav": {
    memoryType: "voice" as const,
    extension: "wav",
  },
};

function getDateInTimezone(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function POST(request: Request) {
  const { profile } = await getRequiredProfile();

  const formData = await request.formData();
  const uploadedFile = formData.get("file");
  const captionValue = formData.get("caption");

  if (!(uploadedFile instanceof File) || uploadedFile.size === 0) {
    return new Response("Choose a photo or voice note before uploading.", {
      status: 400,
    });
  }

  if (uploadedFile.size > maximumFileSize) {
    return new Response("Files must be smaller than 10 MB.", {
      status: 400,
    });
  }

  const fileDefinition =
    allowedFiles[uploadedFile.type as keyof typeof allowedFiles];

  if (!fileDefinition) {
    return new Response(
      "Unsupported file type. Upload JPG, PNG, WEBP, MP3, M4A, OGG, WEBM or WAV files.",
      {
        status: 400,
      },
    );
  }

    const caption =
    typeof captionValue === "string"
      ? captionValue.trim().slice(0, 1000)
      : "";

  const mediaQuota = await checkMediaUploadQuota({
    profile,
    mediaType: fileDefinition.memoryType,
  });

  if (!mediaQuota.allowed) {
    return new Response(mediaQuota.message, {
      status: 403,
    });
  }

  const objectKey = `users/${profile.id}/${fileDefinition.memoryType}/${randomUUID()}.${fileDefinition.extension}`;

    try {
    const body = Buffer.from(await uploadedFile.arrayBuffer());

    let voiceDurationSeconds: number | null = null;

    if (fileDefinition.memoryType === "voice") {
      voiceDurationSeconds = await getAudioDurationSeconds({
        buffer: body,
        extension: fileDefinition.extension,
      });

      const transcriptionQuota = await checkTranscriptionDurationQuota({
        profile,
        durationSeconds: voiceDurationSeconds,
      });

      if (!transcriptionQuota.allowed) {
        return new Response(transcriptionQuota.message, {
          status: 403,
        });
      }
    }

    await uploadPrivateObject({
      key: objectKey,
      body,
      contentType: uploadedFile.type,
    });

    const createdMemories = await db
      .insert(memories)
      .values({
        userId: profile.id,
        source: "web",
        type: fileDefinition.memoryType,
        rawText: caption || null,
        mediaKey: objectKey,
        mediaMimeType: uploadedFile.type,
        mediaSizeBytes: uploadedFile.size,
        voiceDurationSeconds,
        transcribedDurationSeconds:
          fileDefinition.memoryType === "voice" ? voiceDurationSeconds : null,
        transcriptionStatus:
          fileDefinition.memoryType === "voice" ? "queued" : "not_requested",
        originalFileName: uploadedFile.name.slice(0, 255),
        memoryDate: getDateInTimezone(profile.timezone),
        isPrivate: true,
      })
      .returning({
        id: memories.id,
      });

    const createdMemory = createdMemories[0];

    await db
      .update(profiles)
      .set({
        lastActiveAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, profile.id));

    if (createdMemory && fileDefinition.memoryType === "voice") {
      await queueVoiceTranscription(createdMemory.id).catch((error) => {
        console.error(
          "Automatic website voice transcription queue failed:",
          error,
        );
      });
    }
  } catch (error) {
    await deletePrivateObject(objectKey).catch(() => undefined);

    console.error("Media upload failed:", error);

    return new Response("Could not upload this memory.", {
      status: 500,
    });
  }

  redirect("/dashboard/memories?uploaded=true");
}