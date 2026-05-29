import Link from "next/link";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
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
          Begin privately
        </h1>

        <p className="mt-3 leading-7 text-stone-600">
          Create your account to begin collecting the fragments of your life.
        </p>

        <RegisterForm />

        <p className="mt-8 text-sm text-stone-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-stone-900 underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}