import { createHash, randomBytes } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { getPublicAppUrl } from "@/lib/public-url";
import {
  memories,
  profiles,
  telegramLinkTokens,
  telegramOnboardingTokens,
  telegramProcessedUpdates,
} from "@/db/schema";
import { uploadPrivateObject } from "@/lib/r2";
import { hasActiveAiPlan } from "@/lib/subscription";
import { enqueueVoiceTranscriptionForPaidUser } from "@/lib/voice-transcription";
import {
  downloadTelegramFile,
  getTelegramWebhookSecret,
  sendTelegramMessage,
  sendTelegramWebAppButtonMessage,
} from "@/lib/telegram";

export const runtime = "nodejs";

const maximumTelegramMediaSize = 10 * 1024 * 1024;

type TelegramPhotoSize = {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  width: number;
  height: number;
};

type TelegramVoice = {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
};

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    text?: string;
    caption?: string;
    photo?: TelegramPhotoSize[];
    voice?: TelegramVoice;
    chat: {
      id: number;
      type: string;
      username?: string;
    };
    from?: {
      id: number;
      is_bot?: boolean;
      username?: string;
    };
  };
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getDateInTimezone(timezone: string, telegramTimestamp: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(telegramTimestamp * 1000));
}

async function replySafely(chatId: string, text: string) {
  await sendTelegramMessage(chatId, text).catch((error) => {
    console.error("Telegram reply failed:", error);
  });
}

export async function POST(request: Request) {
  const incomingSecret = request.headers.get(
    "x-telegram-bot-api-secret-token",
  );

  if (incomingSecret !== getTelegramWebhookSecret()) {
    return new Response("Unauthorized", {
      status: 401,
    });
  }

  const update = (await request.json()) as TelegramUpdate;
  const message = update.message;

  if (
    !message ||
    message.chat.type !== "private" ||
    message.from?.is_bot === true
  ) {
    return Response.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const messageText = message.text?.trim();
  const caption = message.caption?.trim().slice(0, 1000) || null;

  try {
    /*
      Commands and connection links are processed transactionally.
      This protects one-time connection links and avoids repeated command work.
    */
    if (messageText?.startsWith("/")) {
      const commandResult = await db.transaction(async (tx) => {
        const insertedUpdates = await tx
          .insert(telegramProcessedUpdates)
          .values({
            updateId: update.update_id,
          })
          .onConflictDoNothing({
            target: telegramProcessedUpdates.updateId,
          })
          .returning({
            updateId: telegramProcessedUpdates.updateId,
          });

        if (insertedUpdates.length === 0) {
          return null;
        }

        const startMatch = messageText.match(
          /^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{20,64})$/,
        );

        if (startMatch) {
          const tokenHash = hashToken(startMatch[1]);

          const matchingTokens = await tx
            .select()
            .from(telegramLinkTokens)
            .where(
              and(
                eq(telegramLinkTokens.tokenHash, tokenHash),
                gt(telegramLinkTokens.expiresAt, new Date()),
                isNull(telegramLinkTokens.usedAt),
              ),
            )
            .limit(1);

          const linkToken = matchingTokens[0];

          if (!linkToken) {
            return {
              reply:
                "This connection link is invalid or expired. Return to Keepsake and create a new Telegram connection link.",
            };
          }

          const existingConnections = await tx
            .select({
              id: profiles.id,
            })
            .from(profiles)
            .where(eq(profiles.telegramChatId, chatId))
            .limit(1);

          const existingConnection = existingConnections[0];

          if (
            existingConnection &&
            existingConnection.id !== linkToken.userId
          ) {
            return {
              reply:
                "This Telegram account is already connected to another Keepsake account.",
            };
          }

          await tx
            .update(profiles)
            .set({
              telegramChatId: chatId,
              telegramUsername:
                message.from?.username ?? message.chat.username ?? null,
              telegramLinkedAt: new Date(),
              updatedAt: new Date(),
              lastActiveAt: new Date(),
            })
            .where(eq(profiles.id, linkToken.userId));

          await tx
            .update(telegramLinkTokens)
            .set({
              usedAt: new Date(),
            })
            .where(eq(telegramLinkTokens.id, linkToken.id));

          return {
            reply:
              "Telegram is connected to your Keepsake account. Send a message, photograph, or voice note and it will be saved privately.",
          };
        }

        if (messageText === "/help") {
          return {
            reply:
              "Send a text message, photograph, or voice note and Keepsake will save it privately in your timeline.",
          };
        }

        if (messageText === "/start") {
  const onboardingToken = randomBytes(24).toString("base64url");
  const tokenHash = hashToken(onboardingToken);

  await tx
    .delete(telegramOnboardingTokens)
    .where(eq(telegramOnboardingTokens.chatId, chatId));

  await tx.insert(telegramOnboardingTokens).values({
    chatId,
    telegramUsername:
      message.from?.username ?? message.chat.username ?? null,
    tokenHash,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  return {
    reply: null,
    webApp: {
      text:
        "Welcome to Keepsake. Create your private account securely, then send thoughts, photographs and voice notes here as life happens.",
      buttonText: "Create my Keepsake account",
      url: `${getPublicAppUrl()}/telegram/signup?token=${onboardingToken}`,
    },
  };
}

        return {
          reply: "Unknown command.",
        };
      });

      if (commandResult?.webApp) {
  await sendTelegramWebAppButtonMessage({
    chatId,
    text: commandResult.webApp.text,
    buttonText: commandResult.webApp.buttonText,
    webAppUrl: commandResult.webApp.url,
  }).catch((error) => {
    console.error("Telegram onboarding button failed:", error);
  });
} else if (commandResult?.reply) {
  await replySafely(chatId, commandResult.reply);
}

      return Response.json({ ok: true });
    }

    const linkedProfiles = await db
      .select()
      .from(profiles)
      .where(eq(profiles.telegramChatId, chatId))
      .limit(1);

    const profile = linkedProfiles[0];

    if (!profile) {
      await replySafely(
        chatId,
        "This Telegram chat is not connected yet. Open Keepsake on the web and connect Telegram from your dashboard.",
      );

      return Response.json({ ok: true });
    }

    /*
      Text memories are database-only, so the update marker and memory row
      can be created safely in the same transaction.
    */
    if (messageText) {
      const wasSaved = await db.transaction(async (tx) => {
        const insertedUpdates = await tx
          .insert(telegramProcessedUpdates)
          .values({
            updateId: update.update_id,
          })
          .onConflictDoNothing({
            target: telegramProcessedUpdates.updateId,
          })
          .returning({
            updateId: telegramProcessedUpdates.updateId,
          });

        if (insertedUpdates.length === 0) {
          return false;
        }

        await tx.insert(memories).values({
          userId: profile.id,
          source: "telegram",
          telegramUpdateId: update.update_id,
          type: "text",
          rawText: messageText.slice(0, 4000),
          memoryDate: getDateInTimezone(profile.timezone, message.date),
          isPrivate: true,
        });

        await tx
          .update(profiles)
          .set({
            lastActiveAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(profiles.id, profile.id));

        return true;
      });

      if (wasSaved) {
        await replySafely(chatId, "Saved privately.");
      }

      return Response.json({ ok: true });
    }

    /*
      Telegram sends multiple image sizes. The last entry is the largest
      available photo representation.
    */
    if (message.photo?.length) {
      const largestPhoto = message.photo[message.photo.length - 1];

      if (
        largestPhoto.file_size &&
        largestPhoto.file_size > maximumTelegramMediaSize
      ) {
        await replySafely(chatId, "This photo is too large. Maximum size is 10 MB.");
        return Response.json({ ok: true });
      }

      const downloadedPhoto = await downloadTelegramFile(largestPhoto.file_id);

      if (downloadedPhoto.fileSize > maximumTelegramMediaSize) {
        await replySafely(chatId, "This photo is too large. Maximum size is 10 MB.");
        return Response.json({ ok: true });
      }

      const objectKey = `users/${profile.id}/photo/telegram-${update.update_id}.jpg`;

      await uploadPrivateObject({
        key: objectKey,
        body: downloadedPhoto.body,
        contentType: "image/jpeg",
      });

      const wasSaved = await db.transaction(async (tx) => {
        const insertedUpdates = await tx
          .insert(telegramProcessedUpdates)
          .values({
            updateId: update.update_id,
          })
          .onConflictDoNothing({
            target: telegramProcessedUpdates.updateId,
          })
          .returning({
            updateId: telegramProcessedUpdates.updateId,
          });

        if (insertedUpdates.length === 0) {
          return false;
        }

        await tx.insert(memories).values({
          userId: profile.id,
          source: "telegram",
          telegramUpdateId: update.update_id,
          type: "photo",
          rawText: caption,
          mediaKey: objectKey,
          mediaMimeType: "image/jpeg",
          mediaSizeBytes: downloadedPhoto.fileSize,
          originalFileName: `telegram-photo-${message.message_id}.jpg`,
          memoryDate: getDateInTimezone(profile.timezone, message.date),
          isPrivate: true,
        });

        await tx
          .update(profiles)
          .set({
            lastActiveAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(profiles.id, profile.id));

        return true;
      });

      if (wasSaved) {
        await replySafely(chatId, "Photograph saved privately.");
      }

      return Response.json({ ok: true });
    }

    if (message.voice) {
      if (
        message.voice.file_size &&
        message.voice.file_size > maximumTelegramMediaSize
      ) {
        await replySafely(
          chatId,
          "This voice note is too large. Maximum size is 10 MB.",
        );

        return Response.json({ ok: true });
      }

      const supportedVoiceTypes: Record<string, string> = {
        "audio/ogg": "ogg",
        "audio/mpeg": "mp3",
        "audio/mp4": "m4a",
        "audio/webm": "webm",
        "audio/wav": "wav",
      };

      const mimeType = message.voice.mime_type || "audio/ogg";
      const extension = supportedVoiceTypes[mimeType];

      if (!extension) {
        await replySafely(chatId, "This voice-note format is not supported.");
        return Response.json({ ok: true });
      }

      const downloadedVoice = await downloadTelegramFile(message.voice.file_id);

      if (downloadedVoice.fileSize > maximumTelegramMediaSize) {
        await replySafely(
          chatId,
          "This voice note is too large. Maximum size is 10 MB.",
        );

        return Response.json({ ok: true });
      }

      const objectKey = `users/${profile.id}/voice/telegram-${update.update_id}.${extension}`;

      await uploadPrivateObject({
        key: objectKey,
        body: downloadedVoice.body,
        contentType: mimeType,
      });

      const savedMemoryId = await db.transaction(async (tx) => {
  const insertedUpdates = await tx
    .insert(telegramProcessedUpdates)
    .values({
      updateId: update.update_id,
    })
    .onConflictDoNothing({
      target: telegramProcessedUpdates.updateId,
    })
    .returning({
      updateId: telegramProcessedUpdates.updateId,
    });

  if (insertedUpdates.length === 0) {
    return null;
  }

  const createdMemories = await tx
    .insert(memories)
    .values({
      userId: profile.id,
      source: "telegram",
      telegramUpdateId: update.update_id,
      type: "voice",
      rawText: caption,
      mediaKey: objectKey,
      mediaMimeType: mimeType,
      mediaSizeBytes: downloadedVoice.fileSize,
      originalFileName: `telegram-voice-${message.message_id}.${extension}`,
      memoryDate: getDateInTimezone(profile.timezone, message.date),
      isPrivate: true,
    })
    .returning({
      id: memories.id,
    });

  await tx
    .update(profiles)
    .set({
      lastActiveAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, profile.id));

  return createdMemories[0]?.id ?? null;
});

if (savedMemoryId) {
  await enqueueVoiceTranscriptionForPaidUser({
    memoryId: savedMemoryId,
    profile,
  }).catch((error) => {
    console.error("Automatic Telegram voice transcription queue failed:", error);
  });

  await replySafely(
    chatId,
    hasActiveAiPlan(profile)
      ? "Voice note saved privately. Transcription is being prepared."
      : "Voice note saved privately.",
  );
}

      return Response.json({ ok: true });
    }

    await replySafely(
      chatId,
      "Send a text message, photograph, or voice note to save a memory.",
    );

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook processing failed:", error);

    return new Response("Webhook processing failed.", {
      status: 500,
    });
  }
}