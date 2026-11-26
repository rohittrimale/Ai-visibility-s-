import { describe, expect, it } from "vitest";
import { decideForNewReview, isNegative, validatePostText, validateReplyText, weekStartIST } from "@/lib/reviews/policy";

describe("decideForNewReview", () => {
  const base = { hasExistingReply: false, negativeThreshold: 3 } as const;

  it("never auto-posts negative reviews, and alerts on them", () => {
    for (const replyMode of ["manual", "auto_positive", "auto_all"] as const) {
      const decision = decideForNewReview({ ...base, starRating: 2, replyMode });
      expect(decision).toMatchObject({ draft: true, autoPost: false, alert: true });
    }
  });

  it("auto_positive posts only 4 and 5 stars", () => {
    expect(decideForNewReview({ ...base, starRating: 5, replyMode: "auto_positive" }).autoPost).toBe(true);
    expect(decideForNewReview({ ...base, starRating: 4, replyMode: "auto_positive" }).autoPost).toBe(true);
    expect(decideForNewReview({ ...base, starRating: 4, negativeThreshold: 1, replyMode: "auto_positive" }).autoPost).toBe(true);
    expect(decideForNewReview({ ...base, starRating: 3, negativeThreshold: 2, replyMode: "auto_positive" }).autoPost).toBe(false);
  });

  it("auto_all posts everything above the threshold", () => {
    expect(decideForNewReview({ ...base, starRating: 3, negativeThreshold: 2, replyMode: "auto_all" }).autoPost).toBe(true);
    expect(decideForNewReview({ ...base, starRating: 3, negativeThreshold: 3, replyMode: "auto_all" }).autoPost).toBe(false);
  });

  it("manual never auto-posts", () => {
    expect(decideForNewReview({ ...base, starRating: 5, replyMode: "manual" }).autoPost).toBe(false);
  });

  it("skips reviews that already have a reply on Google", () => {
    expect(decideForNewReview({ ...base, hasExistingReply: true, starRating: 1, replyMode: "auto_all" })).toEqual({
      status: "replied_elsewhere",
      draft: false,
      autoPost: false,
      alert: false,
    });
  });

  it("isNegative uses an inclusive threshold", () => {
    expect(isNegative(3, 3)).toBe(true);
    expect(isNegative(4, 3)).toBe(false);
  });
});

describe("validation", () => {
  it("rejects empty and oversized replies", () => {
    expect(validateReplyText("   ")).toMatch(/empty/);
    expect(validateReplyText("x".repeat(4001))).toMatch(/4000/);
    expect(validateReplyText("Thank you!")).toBeNull();
  });

  it("rejects posts with Indian phone numbers", () => {
    expect(validatePostText("Call us on 98765 43210 today")).toMatch(/phone/);
    expect(validatePostText("Call +91-9876543210")).toMatch(/phone/);
    expect(validatePostText("Open from 9 to 9, 365 days a year")).toBeNull();
  });
});

describe("weekStartIST", () => {
  it("returns the Monday of the week in India time", () => {
    // Sunday 23:00 UTC is Monday 04:30 IST
    expect(weekStartIST(new Date("2026-11-29T23:00:00Z"))).toBe("2026-11-30");
    // Wednesday
    expect(weekStartIST(new Date("2026-11-25T10:00:00Z"))).toBe("2026-11-23");
    // Monday early morning IST
    expect(weekStartIST(new Date("2026-11-23T00:30:00Z"))).toBe("2026-11-23");
  });
});
