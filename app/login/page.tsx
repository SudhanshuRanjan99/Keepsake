import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-stone-50 px-6 py-16 text-stone-900">
      <div className="mx-auto max-w-md">
        <Link
          href="/"
          className="text-sm tracking-[0.24em] text-stone-500 uppercase"
        >
          Keepsake
        </Link>

        <h1 className="mt-12 text-3xl font-medium tracking-tight">
          Sign in
        </h1>

        <p className="mt-3 leading-7 text-stone-600">
          Return to your private memory archive.
        </p>

        <LoginForm />

        <p className="mt-8 text-sm text-stone-600">
          New to Keepsake?{" "}
          <Link
            href="/register"
            className="font-medium text-stone-900 underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}