"use client";

import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export function TelegramSignupForm({ token }: { token: string }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("English");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connected, setConnected] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    const result = await authClient.signUp.email({
      name: fullName,
      email,
      password,
    });

    if (result.error) {
      setError(result.error.message || "Could not create your account.");
      setIsSubmitting(false);
      return;
    }

    const connectionResponse = await fetch("/api/telegram/finish-signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        preferredLanguage,
      }),
    });

    if (!connectionResponse.ok) {
      setError(
        "Your account was created, but Telegram could not be linked. Sign in on the website and connect Telegram from Settings.",
      );
      setIsSubmitting(false);
      return;
    }

    setConnected(true);
  }

  if (connected) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6 text-stone-900">
        <section className="max-w-md text-center">
          <p className="text-sm tracking-[0.28em] text-stone-500 uppercase">
            Keepsake
          </p>

          <h1 className="mt-8 text-3xl font-medium tracking-tight">
            Your private account is ready.
          </h1>

          <p className="mt-5 leading-7 text-stone-600">
            Return to the bot and send your first thought, photograph or voice
            note.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-12 text-stone-900">
      <section className="mx-auto max-w-md">
        <p className="text-sm tracking-[0.28em] text-stone-500 uppercase">
          Keepsake
        </p>

        <h1 className="mt-8 text-4xl font-medium tracking-tight">
          Begin privately
        </h1>

        <p className="mt-4 leading-7 text-stone-600">
          Create your account securely. Your password is entered here, never
          sent through Telegram messages.
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-5">
          <div>
            <label className="mb-2 block text-sm text-stone-700">
              Your name
            </label>

            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
              className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-stone-600"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-stone-700">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-stone-600"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-stone-700">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-stone-600"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-stone-700">
              Journal language
            </label>

            <select
              value={preferredLanguage}
              onChange={(event) => setPreferredLanguage(event.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-stone-600"
            >
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
              <option value="Nepali">Nepali</option>
            </select>
          </div>

          {error ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-stone-900 px-7 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSubmitting ? "Creating account..." : "Create private account"}
          </button>
        </form>
      </section>
    </main>
  );
}