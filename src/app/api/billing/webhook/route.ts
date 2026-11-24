import { NextResponse } from "next/server";
import { planForRazorpayPlanId } from "@/lib/billing/plans";
import { verifyWebhookSignature } from "@/lib/billing/razorpay";
import { serviceClient } from "@/lib/store/supabase";

export const dynamic = "force-dynamic";

type Event = {
  event: string;
  payload?: { subscription?: { entity?: { id: string; plan_id: string; notes?: { user_id?: string }; current_end?: number } } };
};

/** Razorpay webhook: the ONLY place a user's plan is changed. Signature-verified on the raw body. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature")))
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });

  const evt = JSON.parse(raw) as Event;
  const sub = evt.payload?.subscription?.entity;
  const userId = sub?.notes?.user_id;
  if (!sub || !userId) return NextResponse.json({ ok: true, ignored: true });

  const db = serviceClient();
  if (["subscription.activated", "subscription.charged", "subscription.resumed"].includes(evt.event)) {
    const plan = planForRazorpayPlanId(sub.plan_id);
    if (plan)
      await db.from("users").update({
        plan, razorpay_subscription_id: sub.id,
        plan_renews_at: sub.current_end ? new Date(sub.current_end * 1000).toISOString() : null,
      }).eq("id", userId);
  } else if (["subscription.cancelled", "subscription.halted", "subscription.completed", "subscription.expired"].includes(evt.event)) {
    await db.from("users").update({ plan: "free" }).eq("id", userId).eq("razorpay_subscription_id", sub.id);
    // paused tracking: stop weekly re-runs
    await db.from("businesses").update({ tracked: false }).eq("user_id", userId);
  }
  return NextResponse.json({ ok: true });
}
