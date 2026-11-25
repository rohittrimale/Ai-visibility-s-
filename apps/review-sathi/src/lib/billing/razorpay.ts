import { hmacSha256Hex, safeEqual } from "@/lib/crypto";

/**
 * Checkout success handler signature for subscriptions:
 * hmac_sha256(razorpay_payment_id + "|" + razorpay_subscription_id, key_secret)
 */
export function verifySubscriptionPayment(opts: {
  paymentId: string;
  subscriptionId: string;
  signature: string;
  keySecret: string;
}): boolean {
  const expected = hmacSha256Hex(`${opts.paymentId}|${opts.subscriptionId}`, opts.keySecret);
  return safeEqual(expected, opts.signature);
}

/** Webhook signature: hmac_sha256(raw request body, webhook secret) in X-Razorpay-Signature. */
export function verifyWebhookSignature(rawBody: string, signature: string | null, webhookSecret: string): boolean {
  if (!signature) return false;
  return safeEqual(hmacSha256Hex(rawBody, webhookSecret), signature);
}

type SubscriptionEntity = {
  id: string;
  status: string;
  plan_id?: string;
  customer_id?: string | null;
  current_end?: number | null;
  notes?: Record<string, string> | unknown[];
};

export type WebhookUpdate = {
  subscriptionId: string;
  orgId: string | null;
  status: string;
  currentPeriodEnd: string | null;
  customerId: string | null;
  planId: string | null;
};

/** Pulls what we store from a Razorpay subscription.* webhook. Returns null for other events. */
export function parseSubscriptionWebhook(payload: unknown): WebhookUpdate | null {
  const body = payload as { event?: string; payload?: { subscription?: { entity?: SubscriptionEntity } } };
  if (!body?.event?.startsWith("subscription.")) return null;
  const entity = body.payload?.subscription?.entity;
  if (!entity?.id || !entity.status) return null;
  const notes = entity.notes && !Array.isArray(entity.notes) ? entity.notes : {};
  return {
    subscriptionId: entity.id,
    orgId: typeof notes.org_id === "string" ? notes.org_id : null,
    status: entity.status,
    currentPeriodEnd: entity.current_end ? new Date(entity.current_end * 1000).toISOString() : null,
    customerId: entity.customer_id ?? null,
    planId: entity.plan_id ?? null,
  };
}
