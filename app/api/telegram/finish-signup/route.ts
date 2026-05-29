import { createHash } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { profiles, telegramOnboardingTokens } from "@/db/schema";
import { getRequiredProfile } from "@/lib/current-profile";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  const { profile } = await getRequiredProfile();

  const body = (await request.json()) as {
    token?: string;
    preferredLanguage?: string;
  };

  if (!body.token) {
    return Response.json({ error: "Missing token." }, { status: 400 });
  }

  const allowedLanguages = ["English", "Hindi", "Nepali"];

  const preferredLanguage = allowedLanguages.includes(
    body.preferredLanguage ?? "",
  )
    ? body.preferredLanguage!
    : "English";

  const tokens = await db
    .select()
    .from(telegramOnboardingTokens)
    .where(
      and(
        eq(telegramOnboardingTokens.tokenHash, hashToken(body.token)),
        gt(telegramOnboardingTokens.expiresAt, new Date()),
        isNull(telegramOnboardingTokens.usedAt),
      ),
    )
    .limit(1);

  const onboardingToken = tokens[0];

  if (!onboardingToken) {
    return Response.json(
      { error: "This Telegram link is invalid or expired." },
      { status: 400 },
    );
  }

  const alreadyConnected = await db
    .select({
      id: profiles.id,
    })
    .from(profiles)
    .where(eq(profiles.telegramChatId, onboardingToken.chatId))
    .limit(1);

  if (
    alreadyConnected[0] &&
    alreadyConnected[0].id !== profile.id
  ) {
    return Response.json(
      { error: "This Telegram account is already connected." },
      { status: 409 },
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(profiles)
      .set({
        preferredLanguage,
        telegramChatId: onboardingToken.chatId,
        telegramUsername: onboardingToken.telegramUsername,
        telegramLinkedAt: new Date(),
        updatedAt: new Date(),
        lastActiveAt: new Date(),
      })
      .where(eq(profiles.id, profile.id));

    await tx
      .update(telegramOnboardingTokens)
      .set({
        usedAt: new Date(),
      })
      .where(eq(telegramOnboardingTokens.id, onboardingToken.id));
  });

  await sendTelegramMessage(
    onboardingToken.chatId,
    "Your private Keepsake account is ready. Send a thought, photograph or voice note whenever life happens.",
  ).catch((error) => {
    console.error("Telegram welcome message failed:", error);
  });

  return Response.json({ ok: true });
}