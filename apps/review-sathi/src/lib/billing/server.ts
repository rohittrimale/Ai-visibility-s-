import "server-only";
import Razorpay from "razorpay";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PlanId } from "./plans";

let client: Razorpay | null = null;

export function razorpay(): Razorpay {
  client ??= new Razorpay({ key_id: env.razorpayKeyId(), key_secret: env.razorpayKeySecret() });
  return client;
}

export function razorpayPlanId(plan: PlanId): string {
  return plan === "growth" ? env.razorpayPlanGrowth() : env.razorpayPlanStarter();
}

export function planFromRazorpayPlanId(planId: string | null | undefined): PlanId | null {
  if (!planId) return null;
  if (planId === env.razorpayPlanGrowth()) return "growth";
  if (planId === env.razorpayPlanStarter()) return "starter";
  return null;
}

/** Writes a subscription status change to our tables. */
export async function applySubscriptionUpdate(update: {
  orgId: string;
  subscriptionId: string;
  status: string;
  currentPeriodEnd: string | null;
  customerId?: string | null;
  planId?: string | null;
}) {
  const db = supabaseAdmin();
  const plan = planFromRazorpayPlanId(update.planId);
  const patch: Record<string, unknown> = {
    org_id: update.orgId,
    razorpay_subscription_id: update.subscriptionId,
    status: update.status,
  };
  if (update.currentPeriodEnd) patch.current_period_end = update.currentPeriodEnd;
  if (update.customerId) patch.razorpay_customer_id = update.customerId;
  if (plan) patch.plan = plan;

  const { data: existing } = await db.from("subscriptions").select("plan, razorpay_subscription_id").eq("org_id", update.orgId).maybeSingle();
  // Ignore late events for an old subscription the org has since replaced.
  if (existing?.razorpay_subscription_id && existing.razorpay_subscription_id !== update.subscriptionId && update.status !== "active") {
    return;
  }
  if (!plan && !existing) patch.plan = "starter";
  const { error } = await db.from("subscriptions").upsert(patch, { onConflict: "org_id" });
  if (error) throw error;
  if (plan && (update.status === "active" || update.status === "authenticated")) {
    await db.from("orgs").update({ plan }).eq("id", update.orgId);
  }
}
