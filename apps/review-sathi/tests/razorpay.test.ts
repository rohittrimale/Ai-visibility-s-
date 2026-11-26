import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseSubscriptionWebhook, verifySubscriptionPayment, verifyWebhookSignature } from "@/lib/billing/razorpay";

const sign = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest("hex");

describe("verifySubscriptionPayment", () => {
  it("accepts Razorpay's signature over payment_id|subscription_id", () => {
    const signature = sign("pay_123|sub_456", "key_secret");
    expect(verifySubscriptionPayment({ paymentId: "pay_123", subscriptionId: "sub_456", signature, keySecret: "key_secret" })).toBe(true);
  });

  it("rejects a signature for another subscription or secret", () => {
    const signature = sign("pay_123|sub_456", "key_secret");
    expect(verifySubscriptionPayment({ paymentId: "pay_123", subscriptionId: "sub_999", signature, keySecret: "key_secret" })).toBe(false);
    expect(verifySubscriptionPayment({ paymentId: "pay_123", subscriptionId: "sub_456", signature, keySecret: "other" })).toBe(false);
  });
});

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ event: "subscription.charged" });
  it("checks the HMAC of the raw body", () => {
    expect(verifyWebhookSignature(body, sign(body, "whsec"), "whsec")).toBe(true);
    expect(verifyWebhookSignature(body + " ", sign(body, "whsec"), "whsec")).toBe(false);
    expect(verifyWebhookSignature(body, null, "whsec")).toBe(false);
  });
});

describe("parseSubscriptionWebhook", () => {
  it("extracts status, org and period end", () => {
    const update = parseSubscriptionWebhook({
      event: "subscription.charged",
      payload: {
        subscription: {
          entity: { id: "sub_1", status: "active", plan_id: "plan_g", customer_id: "cust_1", current_end: 1767225600, notes: { org_id: "org-1" } },
        },
      },
    });
    expect(update).toEqual({
      subscriptionId: "sub_1",
      orgId: "org-1",
      status: "active",
      currentPeriodEnd: new Date(1767225600 * 1000).toISOString(),
      customerId: "cust_1",
      planId: "plan_g",
    });
  });

  it("handles notes sent as an empty array and ignores other events", () => {
    const update = parseSubscriptionWebhook({
      event: "subscription.halted",
      payload: { subscription: { entity: { id: "sub_2", status: "halted", notes: [] } } },
    });
    expect(update?.orgId).toBeNull();
    expect(parseSubscriptionWebhook({ event: "payment.captured", payload: {} })).toBeNull();
    expect(parseSubscriptionWebhook(null)).toBeNull();
  });
});
