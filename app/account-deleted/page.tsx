import Link from "next/link";

export default function AccountDeletedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6 text-stone-900">
      <section className="max-w-md text-center">
        <p className="text-sm tracking-[0.28em] text-stone-500 uppercase">
          Keepsake
        </p>

        <h1 className="mt-10 text-4xl font-medium tracking-tight">
          Your account has been deleted.
        </h1>

        <p className="mt-5 leading-7 text-stone-600">
          Your private Keepsake records and stored media have been removed.
        </p>

        <Link
          href="/"
          className="mt-10 inline-flex rounded-full border border-stone-300 px-7 py-3 text-sm font-medium text-stone-700"
        >
          Return home
        </Link>
      </section>
    </main>
  );
}