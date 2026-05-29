import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { payments, profiles } from "@/db/schema";
import { getRequiredAdmin } from "@/lib/current-admin";
import { getPrivateObjectUrl } from "@/lib/r2";
import { LogoutButton } from "@/app/dashboard/logout-button";
import {
  approvePaymentAction,
  rejectPaymentAction,
} from "./actions";

function formatDate(value: Date | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-NP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kathmandu",
  }).format(value);
}

export default async function AdminPaymentsPage() {
  await getRequiredAdmin();

  const paymentRows = await db
    .select({
      payment: payments,
      profile: profiles,
    })
    .from(payments)
    .innerJoin(profiles, eq(payments.userId, profiles.id))
    .orderBy(desc(payments.createdAt));

  const reviewedPayments = await Promise.all(
    paymentRows.map(async ({ payment, profile }) => ({
      payment,
      profile,
      proofUrl: payment.screenshotKey
        ? await getPrivateObjectUrl(payment.screenshotKey)
        : null,
    })),
  );

  const pendingPayments = reviewedPayments.filter(
    ({ payment }) => payment.status === "pending",
  );

  const completedPayments = reviewedPayments.filter(
    ({ payment }) => payment.status !== "pending",
  );

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <div>
            <p className="text-sm tracking-[0.28em] text-stone-500 uppercase">
              Keepsake Admin
            </p>
            <p className="mt-1 text-sm text-stone-500">
              Manual payment review
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm text-stone-600 hover:text-stone-900"
            >
              User dashboard
            </Link>

            <LogoutButton />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-sm text-stone-500">Payments</p>

            <h1 className="mt-3 text-4xl font-medium tracking-tight">
              Requests awaiting review
            </h1>
          </div>

          <p className="rounded-full border border-stone-200 bg-white px-5 py-3 text-sm text-stone-600">
            {pendingPayments.length} pending
          </p>
        </div>

        {pendingPayments.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-stone-300 px-6 py-16 text-center text-sm text-stone-500">
            No pending payments.
          </div>
        ) : (
          <div className="mt-10 space-y-8">
            {pendingPayments.map(({ payment, profile, proofUrl }) => (
              <article
                key={payment.id}
                className="grid gap-8 rounded-2xl border border-stone-200 bg-white p-6 lg:grid-cols-[340px_1fr]"
              >
                <div>
                  {proofUrl ? (
                    <a
                      href={proofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-xl border border-stone-200 bg-stone-100"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={proofUrl}
                        alt="Private uploaded payment proof"
                        className="max-h-[480px] w-full object-contain"
                      />
                    </a>
                  ) : (
                    <div className="rounded-xl border border-dashed border-stone-300 px-5 py-14 text-center text-sm text-stone-500">
                      No screenshot uploaded.
                    </div>
                  )}

                  <p className="mt-3 text-xs text-stone-500">
                    Click screenshot to inspect full size.
                  </p>
                </div>

                <div>
                  <p className="text-xs tracking-wide text-stone-500 uppercase">
                    Pending payment
                  </p>

                  <h2 className="mt-3 text-2xl font-medium">
                    {profile.fullName}
                  </h2>

                  <dl className="mt-7 space-y-4 text-sm">
                    <div className="flex justify-between gap-6 border-b border-stone-100 pb-4">
                      <dt className="text-stone-500">Requested plan</dt>
                      <dd className="capitalize">{payment.requestedPlan}</dd>
                    </div>

                    <div className="flex justify-between gap-6 border-b border-stone-100 pb-4">
                      <dt className="text-stone-500">Amount</dt>
                      <dd>NPR {payment.amount}</dd>
                    </div>

                    <div className="flex justify-between gap-6 border-b border-stone-100 pb-4">
                      <dt className="text-stone-500">Transaction ID</dt>
                      <dd className="font-mono">{payment.transactionId}</dd>
                    </div>

                    <div className="flex justify-between gap-6 border-b border-stone-100 pb-4">
                      <dt className="text-stone-500">Submitted</dt>
                      <dd>{formatDate(payment.createdAt)}</dd>
                    </div>

                    <div className="flex justify-between gap-6">
                      <dt className="text-stone-500">Current plan</dt>
                      <dd className="capitalize">{profile.plan}</dd>
                    </div>
                  </dl>

                  <div className="mt-8 flex flex-col gap-5">
                    <form action={approvePaymentAction}>
                      <input
                        type="hidden"
                        name="paymentId"
                        value={payment.id}
                      />

                      <button
                        type="submit"
                        className="w-full rounded-full bg-stone-900 px-7 py-3 text-sm font-medium text-white"
                      >
                        Approve payment and activate plan
                      </button>
                    </form>

                    <form
                      action={rejectPaymentAction}
                      className="rounded-xl border border-stone-200 p-4"
                    >
                      <input
                        type="hidden"
                        name="paymentId"
                        value={payment.id}
                      />

                      <label
                        htmlFor={`reviewNote-${payment.id}`}
                        className="mb-2 block text-sm text-stone-600"
                      >
                        Reason for rejection
                      </label>

                      <textarea
                        id={`reviewNote-${payment.id}`}
                        name="reviewNote"
                        required
                        maxLength={300}
                        rows={3}
                        placeholder="Transaction could not be verified."
                        className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-stone-500"
                      />

                      <button
                        type="submit"
                        className="mt-3 rounded-full border border-stone-300 px-6 py-2 text-sm text-stone-700 hover:border-red-400 hover:text-red-700"
                      >
                        Reject payment
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-16">
          <h2 className="text-xl font-medium">Reviewed payments</h2>

          {completedPayments.length === 0 ? (
            <p className="mt-5 text-sm text-stone-500">
              No reviewed payments yet.
            </p>
          ) : (
            <div className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white">
              {completedPayments.map(({ payment, profile }) => (
                <div
                  key={payment.id}
                  className="flex flex-wrap items-center justify-between gap-5 border-b border-stone-100 px-6 py-5 last:border-b-0"
                >
                  <div>
                    <p className="font-medium">{profile.fullName}</p>

                    <p className="mt-1 text-sm text-stone-500">
                      <span className="capitalize">{payment.requestedPlan}</span>
                      {" · "}NPR {payment.amount}
                      {" · "}{payment.transactionId}
                    </p>
                  </div>

                  <div className="text-right">
                    <p
                      className={
                        payment.status === "approved"
                          ? "text-sm text-green-700"
                          : "text-sm text-red-700"
                      }
                    >
                      {payment.status === "approved" ? "Approved" : "Rejected"}
                    </p>

                    <p className="mt-1 text-xs text-stone-500">
                      {formatDate(payment.reviewedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}