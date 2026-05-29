import "server-only";

export type PaidPlan = "plus" | "pro";

function requirePositivePrice(name: string) {
  const rawValue = process.env[name];
  const parsedValue = Number(rawValue);

  if (!rawValue || !Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} must be a positive whole-number NPR amount.`);
  }

  return parsedValue;
}

export function getPaidPlans() {
  return {
    plus: {
      id: "plus" as const,
      name: "Plus",
      amountNpr: requirePositivePrice("PLUS_PRICE_NPR"),
      description: "Daily AI journals, monthly letters and memory resurfacing.",
    },
    pro: {
      id: "pro" as const,
      name: "Pro",
      amountNpr: requirePositivePrice("PRO_PRICE_NPR"),
      description:
        "Everything in Plus, with shared archives and future memoir features.",
    },
  };
}

export function isPaidPlan(value: unknown): value is PaidPlan {
  return value === "plus" || value === "pro";
}