export type PlanId = "starter" | "growth";

export type Plan = {
  id: PlanId;
  name: string;
  priceInr: number;
  maxLocations: number;
  allowAutoAll: boolean;
  features: string[];
};

export const TRIAL_DAYS = 14;

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "Starter",
    priceInr: 1499,
    maxLocations: 1,
    allowAutoAll: false,
    features: [
      "1 Google Business Profile",
      "AI replies in English, Hindi, Hinglish and Marathi",
      "Auto-reply to 4 and 5 star reviews",
      "Email alert within the hour for bad reviews",
      "Weekly AI post drafts",
    ],
  },
  growth: {
    id: "growth",
    name: "Growth",
    priceInr: 2999,
    maxLocations: 5,
    allowAutoAll: true,
    features: [
      "Up to 5 Google Business Profiles",
      "Everything in Starter",
      "Auto-reply to every non-negative review",
      "Weekly post drafts for every location",
      "Priority WhatsApp support",
    ],
  },
};

export function isPlanId(value: unknown): value is PlanId {
  return value === "starter" || value === "growth";
}

export type SubscriptionStatus =
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "expired"
  | "paused";

export type AccessInput = {
  trialEndsAt: string | Date;
  subscription: { status: string; currentPeriodEnd: string | null } | null;
  now?: Date;
};

export type AccessState =
  | { allowed: true; reason: "trial"; daysLeft: number }
  | { allowed: true; reason: "subscribed" }
  | { allowed: true; reason: "grace" }
  | { allowed: false; reason: "trial_ended" | "payment_failed" | "cancelled" };

/**
 * Whether an org may use paid features right now.
 * - active / authenticated: paid up (authenticated means the UPI mandate is set and the first charge is scheduled)
 * - pending: Razorpay is retrying a failed charge, so keep access while it retries
 * - cancelled: access continues until the end of the paid period
 */
export function accessState({ trialEndsAt, subscription, now = new Date() }: AccessInput): AccessState {
  const status = subscription?.status;
  if (status === "active" || status === "authenticated") return { allowed: true, reason: "subscribed" };
  if (status === "pending") return { allowed: true, reason: "grace" };
  if (status === "cancelled" && subscription?.currentPeriodEnd && Date.parse(subscription.currentPeriodEnd) > now.getTime()) {
    return { allowed: true, reason: "subscribed" };
  }

  const trialEnd = new Date(trialEndsAt).getTime();
  if (trialEnd > now.getTime()) {
    return { allowed: true, reason: "trial", daysLeft: Math.ceil((trialEnd - now.getTime()) / 86_400_000) };
  }
  if (status === "halted") return { allowed: false, reason: "payment_failed" };
  if (status === "cancelled" || status === "completed" || status === "expired") return { allowed: false, reason: "cancelled" };
  return { allowed: false, reason: "trial_ended" };
}

export function maxLocationsFor(plan: string, onTrial: boolean): number {
  if (onTrial) return PLANS.growth.maxLocations;
  return isPlanId(plan) ? PLANS[plan].maxLocations : PLANS.starter.maxLocations;
}
