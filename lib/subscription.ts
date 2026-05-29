

type SubscriptionProfile = {
  plan: "free" | "plus" | "pro";
  subscriptionStatus: "inactive" | "pending" | "active" | "expired";
  subscriptionEndsAt: Date | null;
};

export function hasActiveAiPlan(profile: SubscriptionProfile) {
  if (profile.plan !== "plus" && profile.plan !== "pro") {
    return false;
  }

  if (profile.subscriptionStatus !== "active") {
    return false;
  }

  if (!profile.subscriptionEndsAt) {
    return false;
  }

  return profile.subscriptionEndsAt.getTime() > Date.now();
}