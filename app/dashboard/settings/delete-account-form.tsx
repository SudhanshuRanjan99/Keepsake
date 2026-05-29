"use client";

import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export function DeleteAccountForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmationMatches = confirmation === "DELETE MY ACCOUNT";

  async function handleDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!confirmationMatches) {
      setError('Type "DELETE MY ACCOUNT" exactly to continue.');
      return;
    }

    setError("");
    setIsDeleting(true);

    const { error: deletionError } = await authClient.deleteUser({
      password,
      callbackURL: "/account-deleted",
    });

    if (deletionError) {
      setError(
        deletionError.message ||
          "Account deletion failed. Check your password and try again.",
      );
      setIsDeleting(false);
    }
  }

  return (
    <form onSubmit={handleDeleteAccount} className="mt-6 space-y-5">
      <div>
        <label
          htmlFor="delete-password"
          className="mb-2 block text-sm text-stone-700"
        >
          Confirm your password
        </label>

        <input
          id="delete-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="current-password"
          className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-red-500"
        />
      </div>

      <div>
        <label
          htmlFor="delete-confirmation"
          className="mb-2 block text-sm text-stone-700"
        >
          Type DELETE MY ACCOUNT
        </label>

        <input
          id="delete-confirmation"
          type="text"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          required
          autoComplete="off"
          className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-red-500"
        />
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!confirmationMatches || isDeleting}
        className="rounded-full bg-red-700 px-7 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isDeleting ? "Deleting account..." : "Permanently delete account"}
      </button>
    </form>
  );
}