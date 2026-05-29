import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";

type ProfileRecord = typeof profiles.$inferSelect;

export async function expireProfileSubscriptionIfNeeded(
  profile: ProfileRecord,
) {
  if (
    profile.subscriptionStatus !== "active" ||
    !profile.subscriptionEndsAt ||
    profile.subscriptionEndsAt.getTime() > Date.now()
  ) {
    return profile;
  }

  const now = new Date();

  const updatedProfiles = await db
    .update(profiles)
    .set({
      plan: "free",
      subscriptionStatus: "expired",
      updatedAt: now,
    })
    .where(
      and(
        eq(profiles.id, profile.id),
        eq(profiles.subscriptionStatus, "active"),
        lte(profiles.subscriptionEndsAt, now),
      ),
    )
    .returning();

  return updatedProfiles[0] ?? profile;
}

export async function expireAllEndedSubscriptions() {
  const now = new Date();

  const expiredProfiles = await db
    .update(profiles)
    .set({
      plan: "free",
      subscriptionStatus: "expired",
      updatedAt: now,
    })
    .where(
      and(
        eq(profiles.subscriptionStatus, "active"),
        lte(profiles.subscriptionEndsAt, now),
      ),
    )
    .returning({
      id: profiles.id,
    });

  return expiredProfiles.length;
}