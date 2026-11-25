import { describe, expect, it } from "vitest";
import { formatAddress, normalizeReview, originalReviewText, starRatingToNumber } from "@/lib/google/types";

describe("starRatingToNumber", () => {
  it("maps Google's words to numbers", () => {
    expect(["ONE", "TWO", "THREE", "FOUR", "FIVE"].map(starRatingToNumber)).toEqual([1, 2, 3, 4, 5]);
    expect(starRatingToNumber("STAR_RATING_UNSPECIFIED")).toBe(0);
    expect(starRatingToNumber(undefined)).toBe(0);
  });
});

describe("originalReviewText", () => {
  it("keeps only the original when Google added a translation", () => {
    expect(originalReviewText("(Translated by Google) Very good food\n\n(Original)\nबहुत अच्छा खाना")).toBe("बहुत अच्छा खाना");
  });
  it("leaves normal text alone and turns blank into null", () => {
    expect(originalReviewText(" Great place ")).toBe("Great place");
    expect(originalReviewText("   ")).toBeNull();
    expect(originalReviewText(undefined)).toBeNull();
  });
});

describe("normalizeReview", () => {
  it("normalises a full review", () => {
    expect(
      normalizeReview({
        name: "accounts/1/locations/2/reviews/3",
        reviewer: { displayName: "Priya" },
        starRating: "FIVE",
        comment: "Lovely",
        createTime: "2026-11-01T10:00:00Z",
        updateTime: "2026-11-01T10:00:00Z",
        reviewReply: { comment: "Thanks!", updateTime: "2026-11-02T10:00:00Z" },
      }),
    ).toEqual({
      name: "accounts/1/locations/2/reviews/3",
      reviewerName: "Priya",
      starRating: 5,
      comment: "Lovely",
      createTime: "2026-11-01T10:00:00Z",
      updateTime: "2026-11-01T10:00:00Z",
      reply: { comment: "Thanks!", updateTime: "2026-11-02T10:00:00Z" },
    });
  });

  it("hides anonymous names and drops unusable reviews", () => {
    expect(normalizeReview({ name: "r", reviewer: { displayName: "A Google User", isAnonymous: true }, starRating: "ONE", createTime: "t" })?.reviewerName).toBeNull();
    expect(normalizeReview({ name: "r", starRating: "STAR_RATING_UNSPECIFIED", createTime: "t" })).toBeNull();
    expect(normalizeReview({ starRating: "ONE", createTime: "t" })).toBeNull();
  });
});

describe("formatAddress", () => {
  it("joins the parts that exist", () => {
    expect(formatAddress({ addressLines: ["12 FC Road"], locality: "Pune", administrativeArea: "MH", postalCode: "411004" })).toBe(
      "12 FC Road, Pune, MH, 411004",
    );
    expect(formatAddress({})).toBeNull();
    expect(formatAddress(undefined)).toBeNull();
  });
});
