import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { memories } from "@/db/schema";
import { getRequiredProfile } from "@/lib/current-profile";
import { getPrivateObjectUrl } from "@/lib/r2";
import { hasActiveAiPlan } from "@/lib/subscription";
import { LogoutButton } from "../logout-button";
import {
  createMemoryAction,
  deleteMemoryAction,
  queueVoiceTranscriptionAction,
  updateMemoryAction,
} from "./actions";

type MemoriesPageProps = {
  searchParams: Promise<{
    uploaded?: string;
  }>;
};

export default async function MemoriesPage({
  searchParams,
}: MemoriesPageProps) {
  const { profile } = await getRequiredProfile();
  const canUseAi = hasActiveAiPlan(profile);
  const params = await searchParams;

  const userMemories = await db
    .select()
    .from(memories)
    .where(eq(memories.userId, profile.id))
    .orderBy(desc(memories.createdAt));

  const memoriesWithMedia = await Promise.all(
    userMemories.map(async (memory) => ({
      memory,
      mediaUrl: memory.mediaKey
        ? await getPrivateObjectUrl(memory.mediaKey)
        : null,
    })),
  );

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
            className="block font-medium text-stone-900"
          >
            Timeline
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

        <section className="max-w-2xl">
          <p className="text-sm text-stone-500">Private timeline</p>

          <h1 className="mt-4 text-4xl font-medium tracking-tight">
            What happened today?
          </h1>

          <p className="mt-4 max-w-xl leading-7 text-stone-600">
            Write a fragment, keep a photograph, or save a voice note.
          </p>

          {params.uploaded === "true" ? (
            <div className="mt-8 rounded-xl border border-stone-200 bg-white px-5 py-4 text-sm text-stone-700">
              Your private media memory has been saved.
            </div>
          ) : null}

          <form
            action={createMemoryAction}
            className="mt-10 rounded-2xl border border-stone-200 bg-white p-6"
          >
            <label
              htmlFor="rawText"
              className="mb-3 block text-sm text-stone-500"
            >
              Written memory
            </label>

            <textarea
              id="rawText"
              name="rawText"
              required
              maxLength={4000}
              rows={6}
              placeholder="Rain in Patan today. I sat quietly with tea and did not rush home."
              className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-4 leading-7 outline-none placeholder:text-stone-400 focus:border-stone-500"
            />

            <div className="mt-4 flex items-center justify-between gap-4">
              <p className="text-xs text-stone-500">
                Private. Visible only to your account.
              </p>

              <button
                type="submit"
                className="rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white"
              >
                Save memory
              </button>
            </div>
          </form>

          <form
            action="/api/memories/media"
            method="post"
            encType="multipart/form-data"
            className="mt-6 rounded-2xl border border-stone-200 bg-white p-6"
          >
            <label
              htmlFor="file"
              className="mb-3 block text-sm text-stone-500"
            >
              Photo or voice note
            </label>

            <input
              id="file"
              name="file"
              type="file"
              required
              accept="image/jpeg,image/png,image/webp,audio/mpeg,audio/mp4,audio/ogg,audio/webm,audio/wav"
              className="block w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-700"
            />

            <label
              htmlFor="caption"
              className="mb-3 mt-5 block text-sm text-stone-500"
            >
              Caption
              <span className="ml-2 text-stone-400">Optional</span>
            </label>

            <textarea
              id="caption"
              name="caption"
              maxLength={1000}
              rows={3}
              placeholder="A quiet evening at home."
              className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-4 leading-7 outline-none placeholder:text-stone-400 focus:border-stone-500"
            />

            <div className="mt-4 flex items-center justify-between gap-4">
              <p className="text-xs text-stone-500">
                JPG, PNG, WEBP, MP3, M4A, OGG, WEBM or WAV. Maximum 10 MB.
              </p>

              <button
                type="submit"
                className="rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white"
              >
                Save media
              </button>
            </div>
          </form>

          <div className="mt-12">
            <h2 className="text-lg font-medium">Your memories</h2>

            {memoriesWithMedia.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-stone-300 px-6 py-12 text-center text-sm text-stone-500">
                Nothing saved yet. Your first fragment can be small.
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                {memoriesWithMedia.map(({ memory, mediaUrl }) => (
                  <article
                    key={memory.id}
                    className="rounded-2xl border border-stone-200 bg-white p-6"
                  >
                    <div className="flex items-start justify-between gap-6">
                      <div>
                        <p className="text-xs tracking-wide text-stone-500 uppercase">
                          {memory.memoryDate}
                        </p>

                        <p className="mt-2 text-xs capitalize text-stone-400">
                          {memory.type}
                        </p>
                      </div>

                      <form action={deleteMemoryAction}>
                        <input
                          type="hidden"
                          name="memoryId"
                          value={memory.id}
                        />

                        <button
                          type="submit"
                          className="text-xs text-stone-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </form>
                    </div>

                    {mediaUrl && memory.type === "photo" ? (
                      <div className="mt-5 overflow-hidden rounded-xl bg-stone-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={mediaUrl}
                          alt={memory.rawText || "Private memory photograph"}
                          className="max-h-[520px] w-full object-cover"
                        />
                      </div>
                    ) : null}

                    {mediaUrl && memory.type === "voice" ? (
  <div className="mt-5">
    <audio
      controls
      preload="metadata"
      src={mediaUrl}
      className="w-full"
    />

    {memory.transcript ? (
      <div className="mt-5 rounded-xl bg-stone-50 px-4 py-4">
        <p className="text-xs tracking-wide text-stone-500 uppercase">
          Transcript
        </p>

        <p className="mt-3 whitespace-pre-wrap leading-7 text-stone-800">
          {memory.transcript}
        </p>
      </div>
    ) : null}

    {!memory.transcript && memory.transcriptionStatus === "processing" ? (
  <p className="mt-4 text-sm text-stone-500">
    Writing down your voice note...
  </p>
) : null}

    {!memory.transcript && memory.transcriptionStatus === "queued" ? (
  <p className="mt-4 text-sm text-stone-500">
    Voice note saved. Transcription is waiting to begin.
  </p>
) : null}

    {memory.transcriptionStatus === "failed" ? (
      <p className="mt-4 text-sm text-red-700">
        Transcription failed. You can try again.
      </p>
    ) : null}

    {!memory.transcript &&
    canUseAi &&
    (memory.transcriptionStatus === "not_requested" ||
      memory.transcriptionStatus === "failed") ? (
      <form action={queueVoiceTranscriptionAction} className="mt-4">
        <input type="hidden" name="memoryId" value={memory.id} />

        <button
          type="submit"
          className="rounded-full border border-stone-300 px-5 py-2 text-sm text-stone-700 hover:border-stone-500"
        >
          Transcribe voice note
        </button>
      </form>
    ) : null}

    {!memory.transcript && !canUseAi ? (
      <p className="mt-4 text-sm text-stone-500">
        Voice transcription is available with an active Plus or Pro plan.
      </p>
    ) : null}
  </div>
) : null}

                    {memory.rawText ? (
                      <p className="mt-5 whitespace-pre-wrap leading-7 text-stone-800">
                        {memory.rawText}
                      </p>
                    ) : null}

                    {memory.type === "text" ? (
                      <details className="mt-5 border-t border-stone-100 pt-4">
                        <summary className="cursor-pointer text-sm text-stone-500 hover:text-stone-900">
                          Edit memory
                        </summary>

                        <form action={updateMemoryAction} className="mt-4">
                          <input
                            type="hidden"
                            name="memoryId"
                            value={memory.id}
                          />

                          <textarea
                            name="rawText"
                            required
                            maxLength={4000}
                            rows={5}
                            defaultValue={memory.rawText ?? ""}
                            className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-4 leading-7 outline-none focus:border-stone-500"
                          />

                          <button
                            type="submit"
                            className="mt-4 rounded-full border border-stone-300 px-5 py-2 text-sm font-medium text-stone-800 hover:border-stone-500"
                          >
                            Save changes
                          </button>
                        </form>
                      </details>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}