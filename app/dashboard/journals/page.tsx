import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { journalEntries } from "@/db/schema";
import { getRequiredProfile } from "@/lib/current-profile";
import { hasActiveAiPlan } from "@/lib/subscription";
import { LogoutButton } from "../logout-button";
import {
  generateTodayJournalAction,
  updateJournalAction,
} from "./actions";

type JournalsPageProps = {
  searchParams: Promise<{
    status?: string;
    error?: string;
  }>;
};

const successMessages: Record<string, string> = {
  queued: "Your journal is being written. Refresh this page shortly.",
  saved: "Your edited journal has been saved.",
  "already-processing": "Today’s journal is already being written.",
  "already-created": "Today’s journal has already been created.",
};

const errorMessages: Record<string, string> = {
  "paid-plan-required":
    "Daily journal writing requires an active Plus or Pro subscription.",
  "no-memories": "There are no memories saved for today yet.",
  "voice-not-ready":
    "A voice note from today has not been transcribed yet. Finish transcription before creating the journal.",
  "no-written-source":
    "Today has no text, caption or completed voice transcript to write from.",
};

function formatJournalDate(value: string) {
  return new Intl.DateTimeFormat("en-NP", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export default async function JournalsPage({
  searchParams,
}: JournalsPageProps) {
  const { profile } = await getRequiredProfile();
  const params = await searchParams;
  const canUseAi = hasActiveAiPlan(profile);

  const userJournals = await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.userId, profile.id))
    .orderBy(desc(journalEntries.journalDate));

  const successMessage = params.status
    ? successMessages[params.status]
    : null;

  const errorMessage = params.error ? errorMessages[params.error] : null;

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
            className="block hover:text-stone-900"
          >
            Telegram
          </Link>

          <Link
            href="/dashboard/journals"
            className="block font-medium text-stone-900"
          >
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

        <section className="max-w-3xl">
          <p className="text-sm text-stone-500">Private journal</p>

          <h1 className="mt-4 text-4xl font-medium tracking-tight">
            A day gathered gently
          </h1>

          <p className="mt-4 max-w-xl leading-7 text-stone-600">
            Keepsake writes only from the memories you saved. Read the draft,
            change anything that does not feel right, and keep the final words
            as your own.
          </p>

          {successMessage ? (
            <div className="mt-8 rounded-xl border border-stone-200 bg-white px-5 py-4 text-sm text-stone-700">
              {successMessage}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-8 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-10 rounded-2xl border border-stone-200 bg-white p-6">
            <p className="text-sm text-stone-500">Today</p>

            {canUseAi ? (
              <>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  Generate a draft from today’s written fragments, photo
                  captions and completed voice transcripts.
                </p>

                <form action={generateTodayJournalAction} className="mt-6">
                  <button
                    type="submit"
                    className="rounded-full bg-stone-900 px-7 py-3 text-sm font-medium text-white"
                  >
                    Generate today&apos;s journal
                  </button>
                </form>
              </>
            ) : (
              <p className="mt-3 text-sm leading-6 text-stone-600">
                AI-written journals are available with an active Plus or Pro
                plan. Your raw memories remain private and available in your
                timeline.
              </p>
            )}
          </div>

          <div className="mt-12 space-y-7">
            {userJournals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 px-6 py-14 text-center text-sm text-stone-500">
                No journal entries written yet.
              </div>
            ) : (
              userJournals.map((journal) => (
                <article
                  key={journal.id}
                  className="rounded-2xl border border-stone-200 bg-white p-6"
                >
                  <p className="text-xs tracking-wide text-stone-500 uppercase">
                    {formatJournalDate(journal.journalDate)}
                  </p>

                  {journal.generationStatus === "queued" ? (
                    <p className="mt-5 text-sm text-stone-500">
                      Waiting to write this journal...
                    </p>
                  ) : null}

                  {journal.generationStatus === "processing" ? (
                    <p className="mt-5 text-sm text-stone-500">
                      Writing this journal from your memories...
                    </p>
                  ) : null}

                  {journal.generationStatus === "failed" ? (
                    <div className="mt-5">
                      <p className="text-sm text-red-700">
                        This journal could not be written.
                      </p>

                      {journal.generationError ? (
                        <p className="mt-2 text-sm text-stone-500">
                          {journal.generationError}
                        </p>
                      ) : null}

                      <form
                        action={generateTodayJournalAction}
                        className="mt-5"
                      >
                        <button
                          type="submit"
                          className="rounded-full border border-stone-300 px-5 py-2 text-sm text-stone-700"
                        >
                          Try again
                        </button>
                      </form>
                    </div>
                  ) : null}

                  {journal.generationStatus === "completed" &&
                  journal.finalText ? (
                    <>
                      <p className="mt-6 whitespace-pre-wrap leading-8 text-stone-800">
                        {journal.finalText}
                      </p>

                      <details className="mt-7 border-t border-stone-100 pt-5">
                        <summary className="cursor-pointer text-sm text-stone-500 hover:text-stone-900">
                          Edit journal entry
                        </summary>

                        <form action={updateJournalAction} className="mt-5">
                          <input
                            type="hidden"
                            name="journalId"
                            value={journal.id}
                          />

                          <textarea
                            name="finalText"
                            required
                            maxLength={20000}
                            rows={12}
                            defaultValue={journal.finalText}
                            className="w-full resize-y rounded-xl border border-stone-200 bg-stone-50 px-4 py-4 leading-8 outline-none focus:border-stone-500"
                          />

                          <button
                            type="submit"
                            className="mt-4 rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white"
                          >
                            Save journal changes
                          </button>
                        </form>
                      </details>

                      {journal.status === "edited" ? (
                        <p className="mt-5 text-xs text-stone-500">
                          Edited by you.
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}