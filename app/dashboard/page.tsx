import Link from "next/link";
import { getRequiredProfile } from "@/lib/current-profile";
import { LogoutButton } from "./logout-button";

export default async function DashboardPage() {
  const { session, profile } = await getRequiredProfile();
  const isAdmin =
  session.user.email.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase();

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
          <Link href="/dashboard" className="block font-medium text-stone-900">
            Today
          </Link>

          <Link href="/dashboard/memories" className="block hover:text-stone-900">
  Timeline
</Link>

<Link href="/dashboard/telegram" className="block hover:text-stone-900">
  Telegram
</Link>

<Link href="/dashboard/journals" className="block hover:text-stone-900">
  Journals
</Link>
          <p>Letters</p>

<Link href="/dashboard/billing" className="block hover:text-stone-900">
  Billing
</Link>

<p>Book</p>

<Link href="/dashboard/settings" className="block hover:text-stone-900">
  Settings
</Link>

{isAdmin ? (
  <Link href="/admin/payments" className="block pt-6 text-stone-900">
    Admin payments
  </Link>
) : null}

        </nav>

        <section>
          <p className="text-sm text-stone-500">
            Welcome back, {profile.fullName}
          </p>

          <h1 className="mt-4 max-w-xl text-4xl font-medium tracking-tight">
            What would you like to remember about today?
          </h1>

          <Link
            href="/dashboard/memories"
            className="mt-10 inline-flex rounded-full bg-stone-900 px-7 py-3 text-sm font-medium text-white"
          >
            Write a memory
          </Link>

          <div className="mt-10 rounded-2xl border border-stone-200 bg-white p-6">
            <p className="text-sm text-stone-500">Your account is ready.</p>

            <dl className="mt-6 space-y-4 text-sm">
              <div className="flex justify-between gap-6 border-b border-stone-100 pb-4">
                <dt className="text-stone-500">Email</dt>
                <dd>{session.user.email}</dd>
              </div>

              <div className="flex justify-between gap-6 border-b border-stone-100 pb-4">
                <dt className="text-stone-500">Journal language</dt>
                <dd>{profile.preferredLanguage}</dd>
              </div>

              <div className="flex justify-between gap-6">
                <dt className="text-stone-500">Plan</dt>
                <dd className="capitalize">{profile.plan}</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </main>
  );
}