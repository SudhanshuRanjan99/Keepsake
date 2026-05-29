"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function RegisterForm() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const { error: signUpError } = await authClient.signUp.email({
      name: fullName.trim(),
      email: email.trim(),
      password,
    });

    if (signUpError) {
      setError(signUpError.message || "Could not create your account.");
      setIsSubmitting(false);
      return;
    }

    router.push("/dashboard/settings");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10 space-y-5">
      <div>
        <label htmlFor="fullName" className="mb-2 block text-sm text-stone-700">
          Full name
        </label>

        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
          maxLength={120}
          autoComplete="name"
          className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-stone-700"
        />
      </div>

      <div>
        <label htmlFor="email" className="mb-2 block text-sm text-stone-700">
          Email address
        </label>

        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-stone-700"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-2 block text-sm text-stone-700">
          Password
        </label>

        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-stone-700"
        />

        <p className="mt-2 text-xs text-stone-500">
          Use at least 8 characters.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-stone-900 px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}