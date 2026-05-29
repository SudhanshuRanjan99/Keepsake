import Link from "next/link";
import { getRequiredProfile } from "@/lib/current-profile";
import { LogoutButton } from "../logout-button";
import {
  connectTelegramAction,
  disconnectTelegramAction,
} from "./actions";

function formatLinkedDate(value: Date | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-NP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kathmandu",
  }).format(value);
}

export default async function TelegramPage() {
  const { profile } = await getRequiredProfile();

  const connected = Boolean(profile.telegramChatId);

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-stone-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Link
            href="/dashboard"
            className="text-sm tracking-[0.28em] text-stone-500 uppercase"
          >
            Keepsake
          </Link>

          <LogoutButton />
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-[220px_1fr]">
        <nav className="space-y-4 text-sm text-stone-600">
          <Link href="/dashboard" className="block hover:text-stone-900">
            Today
          </Link>

          <Link
            href="/dashboard/memories"
            className="block hover:text-stone-900"
          >
            Timeline
          </Link>

          <Link
            href="/dashboard/telegram"
            className="block font-medium text-stone-900"
          >
            Telegram
          </Link>

          <Link href="/dashboard/journals" className="block hover:text-stone-900">
  Journals
</Link>
          <p>Letters</p>

          <Link
            href="/dashboard/billing"
            className="block hover:text-stone-900"
          >
            Billing
          </Link>

          <p>Book</p>

          <Link
            href="/dashboard/settings"
            className="block hover:text-stone-900"
          >
            Settings
          </Link>
        </nav>

        <section className="max-w-xl">
          <p className="text-sm text-stone-500">Telegram connection</p>

          <h1 className="mt-4 text-4xl font-medium tracking-tight">
            Send moments as they happen
          </h1>

          <p className="mt-4 leading-7 text-stone-600">
            Connect Telegram, then send ordinary messages to your Keepsake bot.
            Each message will appear in your private timeline.
          </p>

          <div className="mt-10 rounded-2xl border border-stone-200 bg-white p-6">
            {connected ? (
              <>
                <p className="text-sm text-stone-500">Connected account</p>

                <p className="mt-3 text-xl font-medium">
                  {profile.telegramUsername
                    ? `@${profile.telegramUsername}`
                    : "Telegram connected"}
                </p>

                {profile.telegramLinkedAt ? (
                  <p className="mt-2 text-sm text-stone-500">
                    Connected {formatLinkedDate(profile.telegramLinkedAt)}
                  </p>
                ) : null}

                <p className="mt-6 text-sm leading-6 text-stone-600">
                  Send a text message to the bot. It will be saved privately in
                  your timeline.
                </p>

                <form action={disconnectTelegramAction} className="mt-7">
                  <button
                    type="submit"
                    className="rounded-full border border-stone-300 px-6 py-3 text-sm text-stone-700 hover:border-red-300 hover:text-red-700"
                  >
                    Disconnect Telegram
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="text-sm text-stone-500">Not connected</p>

                <p className="mt-4 text-sm leading-6 text-stone-600">
                  Clicking connect opens Telegram with a private one-time link.
                  Do not share that link with anyone.
                </p>

                <form action={connectTelegramAction} className="mt-7">
                  <button
                    type="submit"
                    className="rounded-full bg-stone-900 px-7 py-3 text-sm font-medium text-white"
                  >
                    Connect Telegram
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}