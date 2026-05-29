import { eq } from "drizzle-orm";
import { db } from "@/db";
import { memories, payments, profiles } from "@/db/schema";
import { deletePrivateObject } from "@/lib/r2";

export async function deleteKeepsakeContentForAuthUser(authUserId: string) {
  const userProfiles = await db
    .select({
      id: profiles.id,
    })
    .from(profiles)
    .where(eq(profiles.authUserId, authUserId))
    .limit(1);

  const profile = userProfiles[0];

  if (!profile) {
    return;
  }

  const mediaObjects = await db
    .select({
      key: memories.mediaKey,
    })
    .from(memories)
    .where(eq(memories.userId, profile.id));

  const paymentProofObjects = await db
    .select({
      key: payments.screenshotKey,
    })
    .from(payments)
    .where(eq(payments.userId, profile.id));

  const objectKeys = [
    ...mediaObjects.map((object) => object.key),
    ...paymentProofObjects.map((object) => object.key),
  ].filter((key): key is string => Boolean(key));

  for (const key of objectKeys) {
    await deletePrivateObject(key);
  }

  await db.delete(profiles).where(eq(profiles.id, profile.id));
}