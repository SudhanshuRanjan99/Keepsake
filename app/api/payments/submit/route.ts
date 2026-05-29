import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { payments, profiles } from "@/db/schema";
import { hasActiveAiPlan } from "@/lib/subscription";
import { getRequiredProfile } from "@/lib/current-profile";
import { getPaidPlans, isPaidPlan } from "@/lib/plans";
import { deletePrivateObject, uploadPrivateObject } from "@/lib/r2";

export const runtime = "nodejs";

const maximumProofSize = 5 * 1024 * 1024;

const allowedProofFiles = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

function getPublicAppUrl() {
  const appUrl = process.env.BETTER_AUTH_URL?.trim();

  if (!appUrl) {
    throw new Error("BETTER_AUTH_URL is not defined.");
  }

  return appUrl.replace(/\/$/, "");
}

function redirectToBilling(query: string) {
  return Response.redirect(
    `${getPublicAppUrl()}/dashboard/billing?${query}`,
    303,
  );
}

export async function POST(request: Request) {
  const { profile } = await getRequiredProfile();
  const currentlyHasPaidAccess = hasActiveAiPlan(profile);

  const formData = await request.formData();

  const requestedPlanValue = formData.get("requestedPlan");
  const transactionIdValue = formData.get("transactionId");
  const screenshotFile = formData.get("screenshot");

  if (!isPaidPlan(requestedPlanValue)) {
    return redirectToBilling("error=invalid-plan");
  }

  const transactionId =
    typeof transactionIdValue === "string"
      ? transactionIdValue.trim()
      : "";

  if (transactionId.length < 4 || transactionId.length > 120) {
    return redirectToBilling("error=invalid-transaction");
  }

  if (!(screenshotFile instanceof File) || screenshotFile.size === 0) {
    return redirectToBilling("error=missing-proof");
  }

  if (screenshotFile.size > maximumProofSize) {
    return redirectToBilling("error=proof-too-large");
  }

  const extension =
    allowedProofFiles[
      screenshotFile.type as keyof typeof allowedProofFiles
    ];

  if (!extension) {
    return redirectToBilling("error=unsupported-proof");
  }

  const existingPendingPayments = await db
    .select({
      id: payments.id,
    })
    .from(payments)
    .where(
      and(
        eq(payments.userId, profile.id),
        eq(payments.status, "pending"),
      ),
    )
    .limit(1);

  if (existingPendingPayments.length > 0) {
    return redirectToBilling("error=already-pending");
  }

  const selectedPlan = getPaidPlans()[requestedPlanValue];

  const objectKey = `users/${profile.id}/payment-proofs/${randomUUID()}.${extension}`;

  try {
    const fileBody = Buffer.from(await screenshotFile.arrayBuffer());

    await uploadPrivateObject({
      key: objectKey,
      body: fileBody,
      contentType: screenshotFile.type,
    });

    await db.insert(payments).values({
      userId: profile.id,
      requestedPlan: requestedPlanValue,
      amount: String(selectedPlan.amountNpr),
      transactionId,
      screenshotKey: objectKey,
      status: "pending",
    });

   await db
  .update(profiles)
  .set({
    subscriptionStatus: currentlyHasPaidAccess ? "active" : "pending",
    updatedAt: new Date(),
    lastActiveAt: new Date(),
  })
  .where(eq(profiles.id, profile.id));
  } catch (error) {
    await deletePrivateObject(objectKey).catch(() => undefined);

    console.error("Payment submission failed:", error);

    return redirectToBilling("error=submission-failed");
  }

  return redirectToBilling("submitted=true");
}