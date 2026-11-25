import { NextResponse } from "next/server";
import { razorpay } from "@/lib/billing/server";
import { requireOrg } from "@/lib/data/session";

/** Cancels at the end of the current billing cycle, so the customer keeps what they paid for. */
export async function POST() {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return NextResponse.json({ error: "Only the owner can manage billing." }, { status: 403 });
  const id = ctx.subscription?.razorpay_subscription_id;
  if (!id) return NextResponse.json({ error: "No subscription to cancel." }, { status: 400 });
  try {
    // An authenticated subscription (first charge not taken yet) cancels right away.
    const atCycleEnd = ctx.subscription?.status === "active";
    await razorpay().subscriptions.cancel(id, atCycleEnd);
    return NextResponse.json({ ok: true, atCycleEnd });
  } catch (err) {
    console.error("[billing] cancel failed", err);
    return NextResponse.json({ error: "Could not cancel. Please try again or contact support." }, { status: 502 });
  }
}
