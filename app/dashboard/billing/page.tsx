import Image from "next/image";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { getRequiredProfile } from "@/lib/current-profile";
import { getPaidPlans } from "@/lib/plans";
import { LogoutButton } from "../logout-button";

type BillingPageProps = {
  searchParams: Promise<{
    submitted?: string;
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  "invalid-plan": "Choose either Plus or Pro before submitting payment.",
  "invalid-transaction": "Enter a valid transaction ID.",
  "missing-proof": "Upload a screenshot of your payment.",
  "proof-too-large": "Payment screenshots must be smaller than 5 MB.",
  "unsupported-proof": "Upload a JPG, PNG or WEBP screenshot.",
  "already-pending":
    "You already have a pending payment. Wait for review before submitting another.",
  "submission-failed": "Your payment proof could not be saved. Try again.",
};

function formatStatus(status: string) {
  if (status === "pending") return "Pending review";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return status;
}

export default async function BillingPage({
  searchParams,
}: BillingPageProps) {
  const { profile } = await getRequiredProfile();
  const params = await searchParams;
  const plans = getPaidPlans();

  const paymentHistory = await db
    .select()
    .from(payments)
    .where(eq(payments.userId, profile.id))
    .orderBy(desc(payments.createdAt));

  const receiverName =
    process.env.PAYMENT_RECEIVER_NAME ?? "Configure receiver name";
  const paymentMethodLabel =
    process.env.PAYMENT_METHOD_LABEL ?? "Manual QR payment";

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

          <Link href="/dashboard/journals" className="block hover:text-stone-900">
  Journals
</Link>
          <p>Letters</p>

          <Link
            href="/dashboard/billing"
            className="block font-medium text-stone-900"
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
          <p className="text-sm text-stone-500">Billing</p>

          <h1 className="mt-4 text-4xl font-medium tracking-tight">
            Choose how Keepsake grows with you
          </h1>

          <p className="mt-4 max-w-xl leading-7 text-stone-600">
            Free accounts keep raw private memories. Paid plans unlock
            AI-written journals after manual payment approval.
          </p>

          <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-6">
            <p className="text-sm text-stone-500">Current plan</p>

            <div className="mt-3 flex items-center justify-between gap-6">
  <p className="text-2xl font-medium capitalize">{profile.plan}</p>

  <p className="rounded-full border border-stone-200 px-4 py-2 text-sm capitalize text-stone-600">
    {profile.subscriptionStatus}
  </p>
</div>

{profile.subscriptionEndsAt ? (
  <p className="mt-4 text-sm text-stone-500">
    {profile.subscriptionStatus === "active"
      ? "Active until "
      : "Last paid period ended "}
    {new Intl.DateTimeFormat("en-NP", {
      dateStyle: "medium",
      timeZone: profile.timezone,
    }).format(profile.subscriptionEndsAt)}
  </p>
) : null}
          </div>

          {params.submitted === "true" ? (
            <div className="mt-6 rounded-xl border border-stone-200 bg-white px-5 py-4 text-sm text-stone-700">
              Your payment has been submitted for review. Your plan will change
              only after approval.
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {Object.values(plans).map((plan) => (
              <div
                key={plan.id}
                className="rounded-2xl border border-stone-200 bg-white p-6"
              >
                <p className="text-xl font-medium">{plan.name}</p>

                <p className="mt-3 text-3xl font-medium">
                  NPR {plan.amountNpr}
                </p>

                <p className="mt-4 text-sm leading-6 text-stone-600">
                  {plan.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-8 rounded-2xl border border-stone-200 bg-white p-6 md:grid-cols-[220px_1fr]">
            <div>
              <Image
                src="/payments/payment-qr.png"
                alt="Manual payment QR code"
                width={220}
                height={220}
                className="w-full rounded-xl border border-stone-100"
              />

              <p className="mt-4 text-sm font-medium">{paymentMethodLabel}</p>
              <p className="mt-1 text-sm text-stone-500">{receiverName}</p>
            </div>

            <form
              action="/api/payments/submit"
              method="post"
              encType="multipart/form-data"
              className="space-y-5"
            >
              <div>
                <label
                  htmlFor="requestedPlan"
                  className="mb-2 block text-sm text-stone-700"
                >
                  Plan purchased
                </label>

                <select
                  id="requestedPlan"
                  name="requestedPlan"
                  required
                  className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-stone-700"
                >
                  <option value="">Choose plan</option>
                  <option value="plus">
                    Plus — NPR {plans.plus.amountNpr}
                  </option>
                  <option value="pro">
                    Pro — NPR {plans.pro.amountNpr}
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="transactionId"
                  className="mb-2 block text-sm text-stone-700"
                >
                  Transaction ID
                </label>

                <input
                  id="transactionId"
                  name="transactionId"
                  type="text"
                  required
                  maxLength={120}
                  placeholder="Enter your payment reference"
                  className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-stone-700"
                />
              </div>

              <div>
                <label
                  htmlFor="screenshot"
                  className="mb-2 block text-sm text-stone-700"
                >
                  Payment screenshot
                </label>

                <input
                  id="screenshot"
                  name="screenshot"
                  type="file"
                  required
                  accept="image/jpeg,image/png,image/webp"
                  className="block w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-700"
                />

                <p className="mt-2 text-xs leading-5 text-stone-500">
                  JPG, PNG or WEBP. Maximum 5 MB. Your proof remains private.
                </p>
              </div>

              <button
                type="submit"
                className="rounded-full bg-stone-900 px-7 py-3 text-sm font-medium text-white"
              >
                Submit payment for review
              </button>
            </form>
          </div>

          <div className="mt-12">
            <h2 className="text-lg font-medium">Payment history</h2>

            {paymentHistory.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-stone-300 px-6 py-10 text-center text-sm text-stone-500">
                No payment submitted yet.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {paymentHistory.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-stone-200 bg-white p-5"
                  >
                    <div>
                      <p className="font-medium capitalize">
                        {payment.requestedPlan}
                      </p>

                      <p className="mt-1 text-sm text-stone-500">
                        NPR {payment.amount} · Transaction:{" "}
                        {payment.transactionId}
                      </p>
                    </div>

                    <p className="rounded-full border border-stone-200 px-4 py-2 text-sm text-stone-600">
                      {formatStatus(payment.status)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}