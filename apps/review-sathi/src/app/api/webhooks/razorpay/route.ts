import { NextResponse, type NextRequest } from "next/server";
import { parseSubscriptionWebhook, verifyWebhookSignature } from "@/lib/billing/razorpay";
import { applySubscriptionUpdate } from "@/lib/billing/server";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Razorpay webhook. Subscribe to: subscription.authenticated, subscription.activated,
 * subscription.charged, subscription.pending, subscription.halted, subscription.cancelled,
 * subscription.completed, subscription.paused, subscription.resumed.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get("x-razorpay-signature"), env.razorpayWebhookSecret())) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const eventId = request.headers.get("x-razorpay-event-id");
  const event = (payload as { event?: string }).event ?? "unknown";
  if (eventId) {
    const { error } = await db.from("billing_events").insert({ id: eventId, event, payload });
    // Duplicate delivery: already processed.
    if (error?.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
  }

  const update = parseSubscriptionWebhook(payload);
  if (!update) return NextResponse.json({ ok: true, ignored: event });

  let orgId = update.orgId;
  if (!orgId) {
    const { data } = await db.from("subscriptions").select("org_id").eq("razorpay_subscription_id", update.subscriptionId).maybeSingle();
    orgId = data?.org_id ?? null;
  }
  if (!orgId) return NextResponse.json({ ok: true, ignored: "unknown subscription" });

  try {
    await applySubscriptionUpdate({ ...update, orgId });
  } catch (err) {
    console.error("[razorpay webhook] update failed", err);
    if (eventId) await db.from("billing_events").delete().eq("id", eventId); // let Razorpay retry
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
