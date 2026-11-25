import { describe, expect, it } from "vitest";
import { accessState, maxLocationsFor, PLANS } from "@/lib/billing/plans";

const now = new Date("2026-11-25T12:00:00Z");
const future = "2026-12-01T00:00:00Z";
const past = "2026-11-20T00:00:00Z";

describe("accessState", () => {
  it("allows a running trial and counts days left", () => {
    expect(accessState({ trialEndsAt: future, subscription: null, now })).toEqual({ allowed: true, reason: "trial", daysLeft: 6 });
  });

  it("blocks after the trial with no subscription", () => {
    expect(accessState({ trialEndsAt: past, subscription: null, now })).toEqual({ allowed: false, reason: "trial_ended" });
  });

  it("allows active and authenticated subscriptions", () => {
    for (const status of ["active", "authenticated"]) {
      expect(accessState({ trialEndsAt: past, subscription: { status, currentPeriodEnd: null }, now }).allowed).toBe(true);
    }
  });

  it("keeps access while Razorpay retries a failed charge", () => {
    expect(accessState({ trialEndsAt: past, subscription: { status: "pending", currentPeriodEnd: null }, now })).toEqual({
      allowed: true,
      reason: "grace",
    });
  });

  it("keeps access after cancelling until the paid period ends", () => {
    expect(accessState({ trialEndsAt: past, subscription: { status: "cancelled", currentPeriodEnd: future }, now }).allowed).toBe(true);
    expect(accessState({ trialEndsAt: past, subscription: { status: "cancelled", currentPeriodEnd: past }, now })).toEqual({
      allowed: false,
      reason: "cancelled",
    });
  });

  it("blocks halted subscriptions once the trial is over", () => {
    expect(accessState({ trialEndsAt: past, subscription: { status: "halted", currentPeriodEnd: null }, now })).toEqual({
      allowed: false,
      reason: "payment_failed",
    });
  });

  it("an unfinished checkout does not end a running trial", () => {
    expect(accessState({ trialEndsAt: future, subscription: { status: "created", currentPeriodEnd: null }, now }).allowed).toBe(true);
  });
});

describe("plans", () => {
  it("prices sit in the planned ₹1,500 to ₹3,000 band", () => {
    for (const plan of Object.values(PLANS)) {
      expect(plan.priceInr).toBeGreaterThanOrEqual(1499);
      expect(plan.priceInr).toBeLessThanOrEqual(3000);
    }
  });

  it("limits locations by plan, with Growth limits during the trial", () => {
    expect(maxLocationsFor("starter", false)).toBe(1);
    expect(maxLocationsFor("growth", false)).toBe(5);
    expect(maxLocationsFor("starter", true)).toBe(5);
    expect(maxLocationsFor("unknown", false)).toBe(1);
  });
});
