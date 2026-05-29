import Link from "next/link";
import { getRequiredProfile } from "@/lib/current-profile";
import { LogoutButton } from "../logout-button";
import { DeleteAccountForm } from "./delete-account-form";
import { updateSettingsAction } from "./actions";

type SettingsPageProps = {
  searchParams: Promise<{
    saved?: string;
  }>;
};

export default async function SettingsPage({
  searchParams,
}: SettingsPageProps) {
  const { profile } = await getRequiredProfile();
  const params = await searchParams;
  const saved = params.saved === "true";

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
  className="block font-medium text-stone-900"
>
  Settings
</Link>
        </nav>

        <section className="max-w-xl">
          <p className="text-sm text-stone-500">Account settings</p>

          <h1 className="mt-4 text-4xl font-medium tracking-tight">
            How Keepsake should write for you
          </h1>

          <p className="mt-4 leading-7 text-stone-600">
            Your language and timezone determine how future journals are
            written and which moments belong to each day.
          </p>

          {saved ? (
            <div className="mt-8 rounded-xl border border-stone-200 bg-white px-5 py-4 text-sm text-stone-700">
              Your settings have been saved.
            </div>
          ) : null}

          <form
            action={updateSettingsAction}
            className="mt-8 space-y-6 rounded-2xl border border-stone-200 bg-white p-6"
          >
            <div>
              <label
                htmlFor="fullName"
                className="mb-2 block text-sm text-stone-700"
              >
                Full name
              </label>

              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                maxLength={120}
                defaultValue={profile.fullName}
                className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-stone-700"
              />
            </div>

            <div>
              <label
                htmlFor="preferredLanguage"
                className="mb-2 block text-sm text-stone-700"
              >
                Journal language
              </label>

              <select
                id="preferredLanguage"
                name="preferredLanguage"
                defaultValue={profile.preferredLanguage}
                className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-stone-700"
              >
                <option value="English">English</option>
                <option value="Nepali">Nepali</option>
                <option value="Hindi">Hindi</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="timezone"
                className="mb-2 block text-sm text-stone-700"
              >
                Timezone
              </label>

              <select
                id="timezone"
                name="timezone"
                defaultValue={profile.timezone}
                className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-stone-700"
              >
                <option value="Asia/Kathmandu">
                  Nepal — Asia/Kathmandu
                </option>
                <option value="Asia/Kolkata">
                  India — Asia/Kolkata
                </option>
                <option value="UTC">UTC</option>
              </select>
            </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50 p-5">
  <div className="flex items-start gap-3">
    <input
      id="automaticJournalsEnabled"
      name="automaticJournalsEnabled"
      type="checkbox"
      defaultChecked={profile.automaticJournalsEnabled}
      className="mt-1 h-4 w-4"
    />

    <div>
      <label
        htmlFor="automaticJournalsEnabled"
        className="block text-sm font-medium text-stone-800"
      >
        Write my daily journal automatically
      </label>

      <p className="mt-2 text-xs leading-5 text-stone-500">
        When active on a paid plan, Keepsake writes from that day&apos;s saved
        memories after your chosen evening time.
      </p>
    </div>
  </div>

  <div className="mt-5">
    <label
      htmlFor="journalHourLocal"
      className="mb-2 block text-sm text-stone-700"
    >
      Evening journal time
    </label>

    <select
      id="journalHourLocal"
      name="journalHourLocal"
      defaultValue={String(profile.journalHourLocal)}
      className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-stone-700"
    >
      <option value="18">6:00 PM</option>
      <option value="19">7:00 PM</option>
      <option value="20">8:00 PM</option>
      <option value="21">9:00 PM</option>
      <option value="22">10:00 PM</option>
      <option value="23">11:00 PM</option>
    </select>

    <p className="mt-2 text-xs leading-5 text-stone-500">
      Time uses your selected timezone.
    </p>
  </div>
</div>

            <div>
              <label
                htmlFor="whatsappNumber"
                className="mb-2 block text-sm text-stone-700"
              >
                WhatsApp number
                <span className="ml-2 text-stone-400">Optional</span>
              </label>

              <input
                id="whatsappNumber"
                name="whatsappNumber"
                type="tel"
                maxLength={30}
                defaultValue={profile.whatsappNumber ?? ""}
                placeholder="+977..."
                className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-stone-700"
              />

              <p className="mt-2 text-xs leading-5 text-stone-500">
                Stored for future WhatsApp linking. Messaging is not active
                yet.
              </p>
            </div>

            <button
              type="submit"
              className="rounded-full bg-stone-900 px-7 py-3 text-sm font-medium text-white"
            >
              Save settings
            </button>
          </form>
          <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-6">
  <p className="text-sm text-stone-500">Your data</p>

  <h2 className="mt-3 text-xl font-medium">
    Export your Keepsake archive
  </h2>

  <p className="mt-3 text-sm leading-6 text-stone-600">
    Download your saved memories, transcripts, journal entries, monthly
    letters and account settings as a JSON file. Photo and audio file downloads
    will be added before public launch.
  </p>

  <a
    href="/api/account/export"
    className="mt-6 inline-flex rounded-full border border-stone-300 px-6 py-3 text-sm font-medium text-stone-800 hover:border-stone-500"
  >
    Download text archive
  </a>
</div>

<div className="mt-8 rounded-2xl border border-red-200 bg-white p-6">
  <p className="text-sm text-red-700">Permanent deletion</p>

  <h2 className="mt-3 text-xl font-medium">
    Delete your Keepsake account
  </h2>

  <p className="mt-3 text-sm leading-6 text-stone-600">
    This permanently removes your memories, journal entries, private photos,
    voice notes, payment proofs and account access. This cannot be undone.
    Download your text archive before deleting your account.
  </p>

  <DeleteAccountForm />
</div>

        </section>
      </div>




    </main>
  );
}