import { createHash, randomBytes } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  memories,
  profiles,
  telegramLinkTokens,
  telegramOnboardingTokens,
  telegramProcessedUpdates,
} from "@/db/schema";
import { getPublicAppUrl } from "@/lib/public-url";
import { uploadPrivateObject } from "@/lib/r2";
import {
  checkMediaUploadQuota,
  checkTranscriptionDurationQuota,
} from "@/lib/media-quotas";
import { queueVoiceTranscription } from "@/lib/jobs";
import { hasActiveAiPlan } from "@/lib/subscription";

import {
  downloadTelegramFile,
  getTelegramWebhookSecret,
  sendTelegramAppMenu,
  sendTelegramMessage,
  sendTelegramSingleAppButton,
  sendTelegramWebAppButtonMessage,
} from "@/lib/telegram";
import { enqueueVoiceTranscriptionForPaidUser } from "@/lib/voice-transcription";

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

type CommandResult =
  | {
      type: "reply";
      text: string;
    }
  | {
      type: "signup";
      text: string;
      buttonText: string;
      url: string;
    }
  | {
      type: "menu";
      text: string;
    }
  | {
      type: "button";
      text: string;
      buttonText: string;
      url: string;
    }
  | null;

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

function parseCommand(messageText: string) {
  const match = messageText.match(
    /^\/([a-zA-Z]+)(?:@\w+)?(?:\s+(.+))?$/,
  );

  if (!match) {
    return null;
  }

  return {
    command: match[1].toLowerCase(),
    argument: match[2]?.trim() ?? null,
  };
}

async function replySafely(chatId: string, text: string) {
  await sendTelegramMessage(chatId, text).catch((error) => {
    console.error("Telegram reply failed:", error);
  });
}

async function sendCommandResult(
  chatId: string,
  result: CommandResult,
  appUrl: string,
) {
  if (!result) {
    return;
  }

  if (result.type === "reply") {
    await replySafely(chatId, result.text);
    return;
  }

  if (result.type === "signup") {
    await sendTelegramWebAppButtonMessage({
      chatId,
      text: result.text,
      buttonText: result.buttonText,
      webAppUrl: result.url,
    }).catch((error) => {
      console.error("Telegram signup button failed:", error);
    });

    return;
  }

  if (result.type === "menu") {
    await sendTelegramAppMenu({
      chatId,
      text: result.text,
      appUrl,
    }).catch((error) => {
      console.error("Telegram menu failed:", error);
    });

    return;
  }

  await sendTelegramSingleAppButton({
    chatId,
    text: result.text,
    buttonText: result.buttonText,
    url: result.url,
  }).catch((error) => {
    console.error("Telegram navigation button failed:", error);
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
  const messageText = message.text?.trim() ?? "";
  const caption = message.caption?.trim().slice(0, 1000) || null;
  const appUrl = getPublicAppUrl();

  try {
    /*
      Commands are handled before ordinary messages so commands never become
      memory entries. The processed-update record also prevents duplicate
      Telegram deliveries from repeating command work.
    */
    if (messageText.startsWith("/")) {
      const commandResult: CommandResult = await db.transaction(async (tx) => {
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

        const parsedCommand = parseCommand(messageText);

        if (!parsedCommand) {
          return {
            type: "reply",
            text: "Unknown command. Send /help to see available commands.",
          };
        }

        const { command, argument } = parsedCommand;

        /*
          Existing website-to-Telegram linking flow:
          /start <one-time-link-token>
        */
        if (command === "start" && argument) {
          if (!/^[A-Za-z0-9_-]{20,64}$/.test(argument)) {
            return {
              type: "reply",
              text:
                "This connection link is invalid or expired. Return to Keepsake and create a new Telegram connection link.",
            };
          }

          const tokenHash = hashToken(argument);

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
              type: "reply",
              text:
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
              type: "reply",
              text:
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
            type: "reply",
            text:
              "Telegram is connected to your Keepsake account. Send a message, photograph, or voice note and it will be saved privately.",
          };
        }

        const connectedProfiles = await tx
          .select({
            id: profiles.id,
            fullName: profiles.fullName,
          })
          .from(profiles)
          .where(eq(profiles.telegramChatId, chatId))
          .limit(1);

        const connectedProfile = connectedProfiles[0];

        /*
          Telegram-first signup for users who do not yet have an account.
          Linked users receive their menu instead of another signup link.
        */
        if (command === "start") {
          if (connectedProfile) {
            return {
              type: "menu",
              text: `Welcome back, ${connectedProfile.fullName}. What would you like to open?`,
            };
          }

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
            type: "signup",
            text:
              "Welcome to Keepsake. Create your private account securely, then send thoughts, photographs and voice notes here as life happens.",
            buttonText: "Create my Keepsake account",
            url: `${appUrl}/telegram/signup?token=${onboardingToken}`,
          };
        }

        if (command === "help") {
          return {
            type: "reply",
            text: [
              "Keepsake saves private fragments of your life.",
              "",
              "Send a message to save a thought.",
              "Send a photograph to save a moment.",
              "Send a voice note to save your words.",
              "",
              "Commands:",
              "/menu — open your private Keepsake pages",
              "/timeline — open your memories",
              "/journal — open your journals",
              "/billing — open plan and payments",
              "/settings — open your settings",
            ].join("\n"),
          };
        }

        if (command === "menu") {
          if (!connectedProfile) {
            return {
              type: "reply",
              text:
                "Your Telegram account is not connected yet. Send /start to create your private Keepsake account.",
            };
          }

          return {
            type: "menu",
            text: "Open your private Keepsake space:",
          };
        }

        const destinations: Record<
          string,
          {
            text: string;
            buttonText: string;
            path: string;
          }
        > = {
          timeline: {
            text: "Your private memory timeline:",
            buttonText: "Open timeline",
            path: "/dashboard/memories",
          },
          journal: {
            text: "Your private journals:",
            buttonText: "Open journals",
            path: "/dashboard/journals",
          },
          billing: {
            text: "Your plan and payment page:",
            buttonText: "Open billing",
            path: "/dashboard/billing",
          },
          settings: {
            text: "Your private settings:",
            buttonText: "Open settings",
            path: "/dashboard/settings",
          },
        };

        const destination = destinations[command];

        if (destination) {
          if (!connectedProfile) {
            return {
              type: "reply",
              text:
                "Your Telegram account is not connected yet. Send /start to begin.",
            };
          }

          return {
            type: "button",
            text: destination.text,
            buttonText: destination.buttonText,
            url: `${appUrl}${destination.path}`,
          };
        }

        return {
          type: "reply",
          text: "Unknown command. Send /help to see available commands.",
        };
      });

      await sendCommandResult(chatId, commandResult, appUrl);

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
        "This Telegram chat is not connected yet. Send /start to create your private Keepsake account.",
      );

      return Response.json({ ok: true });
    }

    /*
      Text memories are database-only, so the update marker and memory row are
      created together inside one transaction.
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
      Telegram provides several photo resolutions. The last one is the
      largest available version.
    */
    if (message.photo?.length) {
      const largestPhoto = message.photo[message.photo.length - 1];

            const photoQuota = await checkMediaUploadQuota({
        profile,
        mediaType: "photo",
      });

      if (!photoQuota.allowed) {
        await replySafely(chatId, photoQuota.message);

        return Response.json({ ok: true });
      }

      if (
        largestPhoto.file_size &&
        largestPhoto.file_size > maximumTelegramMediaSize
      ) {
        await replySafely(
          chatId,
          "This photo is too large. Maximum size is 10 MB.",
        );

        return Response.json({ ok: true });
      }

      const downloadedPhoto = await downloadTelegramFile(largestPhoto.file_id);

      if (downloadedPhoto.fileSize > maximumTelegramMediaSize) {
        await replySafely(
          chatId,
          "This photo is too large. Maximum size is 10 MB.",
        );

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
            const voiceQuota = await checkMediaUploadQuota({
        profile,
        mediaType: "voice",
      });

      if (!voiceQuota.allowed) {
        await replySafely(chatId, voiceQuota.message);

        return Response.json({ ok: true });
      }

      const voiceDurationSeconds = Math.ceil(message.voice.duration || 0);

      if (voiceDurationSeconds <= 0) {
        await replySafely(chatId, "Could not detect this voice note duration.");

        return Response.json({ ok: true });
      }

      const transcriptionQuota = await checkTranscriptionDurationQuota({
        profile,
        durationSeconds: voiceDurationSeconds,
      });

      if (!transcriptionQuota.allowed) {
        await replySafely(chatId, transcriptionQuota.message);

        return Response.json({ ok: true });
      }

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
            voiceDurationSeconds,
            transcribedDurationSeconds: voiceDurationSeconds,
            transcriptionStatus: "queued",
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
                await queueVoiceTranscription(savedMemoryId).catch((error) => {
          console.error(
            "Automatic Telegram voice transcription queue failed:",
            error,
          );
        });

                await replySafely(
          chatId,
          "Voice note saved privately. Transcription is being prepared.",
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