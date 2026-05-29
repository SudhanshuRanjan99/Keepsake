"use server";

import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getRequiredProfile } from "@/lib/current-profile";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const allowedLanguages = ["English", "Nepali", "Hindi"] as const;

const allowedTimezones = [
  "Asia/Kathmandu",
  "Asia/Kolkata",
  "UTC",
] as const;

const settingsSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Your name is required.")
    .max(120, "Your name is too long."),
    automaticJournalsEnabled: z.boolean(),

journalHourLocal: z.coerce
  .number()
  .int()
  .min(18, "Choose an evening journal time.")
  .max(23, "Choose an evening journal time."),

  preferredLanguage: z.enum(allowedLanguages),

  timezone: z.enum(allowedTimezones),

  whatsappNumber: z
    .string()
    .trim()
    .max(30, "Phone number is too long.")
    .optional(),
});

export async function updateSettingsAction(formData: FormData) {
  const { profile } = await getRequiredProfile();

  const validation = settingsSchema.safeParse({
  fullName: formData.get("fullName"),
  preferredLanguage: formData.get("preferredLanguage"),
  timezone: formData.get("timezone"),
  whatsappNumber: formData.get("whatsappNumber") || undefined,
  automaticJournalsEnabled:
    formData.get("automaticJournalsEnabled") === "on",
  journalHourLocal: formData.get("journalHourLocal"),
});

  if (!validation.success) {
    throw new Error(
      validation.error.issues[0]?.message ?? "Could not update settings.",
    );
  }

  await db
    .update(profiles)
    .set({
      fullName: validation.data.fullName,
      preferredLanguage: validation.data.preferredLanguage,
      automaticJournalsEnabled: validation.data.automaticJournalsEnabled,
journalHourLocal: validation.data.journalHourLocal,
      timezone: validation.data.timezone,
      whatsappNumber: validation.data.whatsappNumber || null,
      updatedAt: new Date(),
      lastActiveAt: new Date(),
    })
    .where(eq(profiles.id, profile.id));

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/memories");

  redirect("/dashboard/settings?saved=true");
}