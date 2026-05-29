import { createHash } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { telegramOnboardingTokens } from "@/db/schema";
import { TelegramSignupForm } from "./telegram-signup-form";

type TelegramSignupPageProps = {
  searchParams: Promise<{
    token?: string;
  }>;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export default async function TelegramSignupPage({
  searchParams,
}: TelegramSignupPageProps) {
  const params = await searchParams;
  const token = params.token;

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <p className="text-sm text-stone-600">
          This Telegram signup link is missing or invalid.
        </p>
      </main>
    );
  }

  const onboardingTokens = await db
    .select({
      id: telegramOnboardingTokens.id,
    })
    .from(telegramOnboardingTokens)
    .where(
      and(
        eq(telegramOnboardingTokens.tokenHash, hashToken(token)),
        gt(telegramOnboardingTokens.expiresAt, new Date()),
        isNull(telegramOnboardingTokens.usedAt),
      ),
    )
    .limit(1);

  if (!onboardingTokens[0]) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <p className="text-sm text-stone-600">
          This private signup link has expired. Return to Telegram and press
          Start again.
        </p>
      </main>
    );
  }

  return <TelegramSignupForm token={token} />;
}