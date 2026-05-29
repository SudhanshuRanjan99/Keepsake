import "server-only";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { expireProfileSubscriptionIfNeeded } from "@/lib/subscription-expiry";
import { redirect } from "next/navigation";

export async function getRequiredProfile() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  await db
    .insert(profiles)
    .values({
      authUserId: session.user.id,
      fullName: session.user.name,
      preferredLanguage: "English",
      timezone: "Asia/Kathmandu",
    })
    .onConflictDoNothing({
      target: profiles.authUserId,
    });

  const userProfiles = await db
    .select()
    .from(profiles)
    .where(eq(profiles.authUserId, session.user.id))
    .limit(1);

  const profile = userProfiles[0];

if (!profile) {
  throw new Error("Profile could not be created or loaded.");
}

const currentProfile = await expireProfileSubscriptionIfNeeded(profile);

return {
  session,
  profile: currentProfile,
};
}