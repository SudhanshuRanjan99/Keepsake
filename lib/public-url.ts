export function getPublicAppUrl() {
  const appUrl = process.env.BETTER_AUTH_URL?.trim();

  if (!appUrl) {
    throw new Error("BETTER_AUTH_URL is not defined.");
  }

  return appUrl.replace(/\/$/, "");
}