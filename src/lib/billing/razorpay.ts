import { createHmac, timingSafeEqual } from "node:crypto";
import { PLANS, type PlanId } from "./plans";

const auth = () =>
  "Basic " + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");

/** Creates a Razorpay subscription and returns its hosted checkout URL. */
export async function createSubscription(plan: Exclude<PlanId, "free">, userId: string) {
  const planId = process.env[PLANS[plan].razorpayPlanEnv!];
  if (!planId || !process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) throw new Error("Razorpay is not configured");
  const res = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: { authorization: auth(), "content-type": "application/json" },
    body: JSON.stringify({ plan_id: planId, total_count: 120, customer_notify: 1, notes: { user_id: userId, plan } }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Razorpay returned ${res.status}`);
  const j = (await res.json()) as { id: string; short_url: string };
  return { subscriptionId: j.id, url: j.short_url };
}

/** Verifies X-Razorpay-Signature (HMAC-SHA256 of the raw body) in constant time. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
