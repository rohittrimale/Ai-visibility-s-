import { NextResponse, type NextRequest } from "next/server";
import { isPlanId } from "@/lib/billing/plans";
import { razorpay, razorpayPlanId } from "@/lib/billing/server";
import { requireOrg } from "@/lib/data/session";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Creates a Razorpay subscription for the org and returns what Checkout needs. */
export async function POST(request: NextRequest) {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return NextResponse.json({ error: "Only the owner can manage billing." }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { plan?: string };
  if (!isPlanId(body.plan)) return NextResponse.json({ error: "Choose a plan." }, { status: 400 });

  const current = ctx.subscription;
  if (current && ["active", "authenticated", "pending"].includes(current.status) && current.razorpay_subscription_id) {
    if (current.plan === body.plan) return NextResponse.json({ error: "You're already on this plan." }, { status: 400 });
    // Switch plans from the next billing cycle.
    try {
      await razorpay().subscriptions.update(current.razorpay_subscription_id, {
        plan_id: razorpayPlanId(body.plan),
        schedule_change_at: "cycle_end",
      });
      return NextResponse.json({ changed: true });
    } catch (err) {
      console.error("[billing] plan change failed", err);
      return NextResponse.json({ error: "Could not change plan. UPI subscriptions may not allow plan changes; cancel and subscribe again." }, { status: 502 });
    }
  }

  // During the trial, the first charge happens when the trial ends.
  const trialEnd = Date.parse(ctx.org.trial_ends_at);
  const startAt = trialEnd > Date.now() + 3_600_000 ? Math.floor(trialEnd / 1000) : undefined;

  try {
    const subscription = await razorpay().subscriptions.create({
      plan_id: razorpayPlanId(body.plan),
      total_count: 120, // monthly for up to 10 years; customers can cancel any time
      customer_notify: 1,
      ...(startAt ? { start_at: startAt } : {}),
      notes: { org_id: ctx.org.id, plan: body.plan },
    });
    await supabaseAdmin()
      .from("subscriptions")
      .upsert({ org_id: ctx.org.id, plan: body.plan, razorpay_subscription_id: subscription.id, status: subscription.status }, { onConflict: "org_id" });
    return NextResponse.json({
      subscriptionId: subscription.id,
      keyId: env.razorpayKeyId(),
      email: ctx.email,
      name: ctx.org.name,
    });
  } catch (err) {
    console.error("[billing] subscription create failed", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }
}
