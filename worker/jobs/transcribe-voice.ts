import { execFile } from "child_process";
import { createReadStream } from "fs";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";
import ffmpegPath from "ffmpeg-static";
import OpenAI from "openai";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { memories, profiles } from "@/db/schema";
import { downloadPrivateObject } from "@/lib/r2";
import { hasActiveAiPlan } from "@/lib/subscription";

const execFileAsync = promisify(execFile);

function getOpenAiClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not defined.");
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

function fileExtensionFromMimeType(mimeType: string | null) {
  const supportedExtensions: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "audio/webm": "webm",
  };

  return mimeType ? supportedExtensions[mimeType] : undefined;
}

export async function transcribeVoiceMemory(memoryId: string) {
  const selectedMemories = await db
    .select({
      memory: memories,
      profile: profiles,
    })
    .from(memories)
    .innerJoin(profiles, eq(memories.userId, profiles.id))
    .where(and(eq(memories.id, memoryId), eq(memories.type, "voice")))
    .limit(1);

  const selected = selectedMemories[0];

  if (!selected) {
    return;
  }

  const { memory, profile } = selected;

  if (!hasActiveAiPlan(profile)) {
    await db
      .update(memories)
      .set({
        transcriptionStatus: "failed",
        transcriptionError: "Active Plus or Pro subscription required.",
        updatedAt: new Date(),
      })
      .where(eq(memories.id, memory.id));

    return;
  }

  if (!memory.mediaKey) {
    throw new Error("Voice memory has no media file.");
  }

  await db
    .update(memories)
    .set({
      transcriptionStatus: "processing",
      transcriptionError: null,
      updatedAt: new Date(),
    })
    .where(eq(memories.id, memory.id));

  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "keepsake-transcription-"),
  );

  try {
    const sourceBuffer = await downloadPrivateObject(memory.mediaKey);

    const supportedExtension = fileExtensionFromMimeType(memory.mediaMimeType);

    let audioPath: string;

    if (memory.mediaMimeType === "audio/ogg") {
      if (!ffmpegPath) {
        throw new Error("FFmpeg executable was not found.");
      }

      const sourcePath = path.join(temporaryDirectory, "voice.ogg");
      audioPath = path.join(temporaryDirectory, "voice.mp3");

      await writeFile(sourcePath, sourceBuffer);

      await execFileAsync(ffmpegPath, [
        "-y",
        "-i",
        sourcePath,
        "-vn",
        "-codec:a",
        "libmp3lame",
        "-q:a",
        "4",
        audioPath,
      ]);
    } else if (supportedExtension) {
      audioPath = path.join(
        temporaryDirectory,
        `voice.${supportedExtension}`,
      );

      await writeFile(audioPath, sourceBuffer);
    } else {
      throw new Error(
        `Unsupported transcription audio type: ${memory.mediaMimeType}`,
      );
    }

    const openai = getOpenAiClient();

    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(audioPath),
      model: "gpt-4o-mini-transcribe",
      response_format: "json",
    });

    const transcript = transcription.text.trim();

    if (!transcript) {
      throw new Error("OpenAI returned an empty transcript.");
    }

    await db
      .update(memories)
      .set({
        transcript,
        transcriptionStatus: "completed",
        transcriptionError: null,
        transcribedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(memories.id, memory.id));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown transcription error.";

    await db
      .update(memories)
      .set({
        transcriptionStatus: "failed",
        transcriptionError: message.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(memories.id, memory.id));

    throw error;
  } finally {
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
}