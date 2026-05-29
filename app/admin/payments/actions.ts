"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { payments, profiles } from "@/db/schema";
import { getRequiredAdmin } from "@/lib/current-admin";

const paymentIdSchema = z.object({
  paymentId: z.string().uuid("Invalid payment ID."),
});

const rejectionSchema = z.object({
  paymentId: z.string().uuid("Invalid payment ID."),
  reviewNote: z
    .string()
    .trim()
    .min(3, "Provide a short reason for rejection.")
    .max(300, "Review note is too long."),
});

function getOneMonthFromToday() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date;
}

export async function approvePaymentAction(formData: FormData) {
  const adminSession = await getRequiredAdmin();

  const validation = paymentIdSchema.safeParse({
    paymentId: formData.get("paymentId"),
  });

  if (!validation.success) {
    throw new Error("Invalid payment request.");
  }

  const subscriptionEndsAt = getOneMonthFromToday();

  await db.transaction(async (tx) => {
    const approvedPayments = await tx
      .update(payments)
      .set({
        status: "approved",
        reviewedBy: adminSession.user.email,
        reviewedAt: new Date(),
        reviewNote: "Payment approved.",
        approvedBy: adminSession.user.email,
        approvedAt: new Date(),
      })
      .where(
        and(
          eq(payments.id, validation.data.paymentId),
          eq(payments.status, "pending"),
        ),
      )
      .returning({
        userId: payments.userId,
        requestedPlan: payments.requestedPlan,
      });

    const approvedPayment = approvedPayments[0];

    if (!approvedPayment) {
      return;
    }

    await tx
      .update(profiles)
      .set({
        plan: approvedPayment.requestedPlan,
        subscriptionStatus: "active",
        subscriptionEndsAt,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, approvedPayment.userId));
  });

  revalidatePath("/admin/payments");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/billing");
}

export async function rejectPaymentAction(formData: FormData) {
  const adminSession = await getRequiredAdmin();

  const validation = rejectionSchema.safeParse({
    paymentId: formData.get("paymentId"),
    reviewNote: formData.get("reviewNote"),
  });

  if (!validation.success) {
    throw new Error(
      validation.error.issues[0]?.message ?? "Invalid rejection request.",
    );
  }

  await db.transaction(async (tx) => {
    const rejectedPayments = await tx
      .update(payments)
      .set({
        status: "rejected",
        reviewedBy: adminSession.user.email,
        reviewedAt: new Date(),
        reviewNote: validation.data.reviewNote,
      })
      .where(
        and(
          eq(payments.id, validation.data.paymentId),
          eq(payments.status, "pending"),
        ),
      )
      .returning({
        userId: payments.userId,
      });

    const rejectedPayment = rejectedPayments[0];

    if (!rejectedPayment) {
      return;
    }

    await tx
      .update(profiles)
      .set({
        subscriptionStatus: "inactive",
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, rejectedPayment.userId));
  });

  revalidatePath("/admin/payments");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/billing");
}