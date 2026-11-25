import { NextResponse, type NextRequest } from "next/server";
import { verifySubscriptionPayment } from "@/lib/billing/razorpay";
import { applySubscriptionUpdate, razorpay } from "@/lib/billing/server";
import { requireOrg } from "@/lib/data/session";
import { env } from "@/lib/env";

/** Called by Checkout's success handler. Confirms the signature, then reads the real status from Razorpay. */
export async function POST(request: NextRequest) {
  const ctx = await requireOrg();
  const body = (await request.json().catch(() => ({}))) as {
    razorpay_payment_id?: string;
    razorpay_subscription_id?: string;
    razorpay_signature?: string;
  };
  if (!body.razorpay_payment_id || !body.razorpay_subscription_id || !body.razorpay_signature) {
    return NextResponse.json({ error: "Missing payment details." }, { status: 400 });
  }
  const valid = verifySubscriptionPayment({
    paymentId: body.razorpay_payment_id,
    subscriptionId: body.razorpay_subscription_id,
    signature: body.razorpay_signature,
    keySecret: env.razorpayKeySecret(),
  });
  if (!valid || body.razorpay_subscription_id !== ctx.subscription?.razorpay_subscription_id) {
    return NextResponse.json({ error: "Payment could not be verified." }, { status: 400 });
  }

  const subscription = await razorpay().subscriptions.fetch(body.razorpay_subscription_id);
  await applySubscriptionUpdate({
    orgId: ctx.org.id,
    subscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEnd: subscription.current_end ? new Date(Number(subscription.current_end) * 1000).toISOString() : null,
    customerId: subscription.customer_id ?? null,
    planId: subscription.plan_id,
  });
  return NextResponse.json({ ok: true, status: subscription.status });
}
