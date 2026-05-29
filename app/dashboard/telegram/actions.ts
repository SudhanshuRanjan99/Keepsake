"use server";

import { createHash, randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { profiles, telegramLinkTokens } from "@/db/schema";
import { getRequiredProfile } from "@/lib/current-profile";
import { getTelegramBotUsername } from "@/lib/telegram";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function connectTelegramAction() {
  const { profile } = await getRequiredProfile();

  const token = randomBytes(24).toString("base64url");
  const tokenHash = hashToken(token);

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.transaction(async (tx) => {
    await tx
      .delete(telegramLinkTokens)
      .where(eq(telegramLinkTokens.userId, profile.id));

    await tx.insert(telegramLinkTokens).values({
      userId: profile.id,
      tokenHash,
      expiresAt,
    });
  });

  const botUsername = getTelegramBotUsername();

  redirect(`https://t.me/${botUsername}?start=${token}`);
}

export async function disconnectTelegramAction() {
  const { profile } = await getRequiredProfile();

  await db.transaction(async (tx) => {
    await tx
      .update(profiles)
      .set({
        telegramChatId: null,
        telegramUsername: null,
        telegramLinkedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, profile.id));

    await tx
      .delete(telegramLinkTokens)
      .where(eq(telegramLinkTokens.userId, profile.id));
  });

  revalidatePath("/dashboard/telegram");
  revalidatePath("/dashboard/settings");
}