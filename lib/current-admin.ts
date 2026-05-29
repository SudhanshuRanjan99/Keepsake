import "server-only";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

function getAdminEmail() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (!adminEmail) {
    throw new Error("ADMIN_EMAIL is not defined in .env.local.");
  }

  return adminEmail;
}

export async function getRequiredAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const email = session.user.email.trim().toLowerCase();

  if (email !== getAdminEmail()) {
    notFound();
  }

  return session;
}