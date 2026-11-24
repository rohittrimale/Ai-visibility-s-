import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyWebhookSignature } from "@/lib/billing/razorpay";
import { PLANS, planForRazorpayPlanId } from "@/lib/billing/plans";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "whsec");
});

describe("razorpay", () => {
  const body = '{"event":"subscription.activated"}';
  const sig = createHmac("sha256", "whsec").update(body).digest("hex");
  it("accepts a valid signature", () => expect(verifyWebhookSignature(body, sig)).toBe(true));
  it("rejects tampered body, bad/missing signature or missing secret", () => {
    expect(verifyWebhookSignature(body + " ", sig)).toBe(false);
    expect(verifyWebhookSignature(body, "deadbeef")).toBe(false);
    expect(verifyWebhookSignature(body, null)).toBe(false);
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "");
    expect(verifyWebhookSignature(body, sig)).toBe(false);
  });
  it("maps razorpay plan ids to our plans", () => {
    vi.stubEnv("RAZORPAY_PLAN_STARTER", "plan_s");
    vi.stubEnv("RAZORPAY_PLAN_GROWTH", "plan_g");
    expect(planForRazorpayPlanId("plan_g")).toBe("growth");
    expect(planForRazorpayPlanId("nope")).toBeNull();
  });
  it("matches the spec'd pricing", () => {
    expect([PLANS.starter.priceInr, PLANS.starter.maxPrompts]).toEqual([1499, 25]);
    expect([PLANS.growth.priceInr, PLANS.growth.maxPrompts]).toEqual([3999, 100]);
  });
});
