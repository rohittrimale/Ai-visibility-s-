import { describe, expect, it } from "vitest";
import {
  normalizeIndianPhone,
  reviewRequestMessage,
  shortReviewLink,
  validateCustomReviewUrl,
  whatsappLink,
} from "@/lib/reviews/requests";

describe("reviewRequestMessage", () => {
  const link = "https://app.example.in/r/abc123";

  it("writes each language with the link and business name", () => {
    for (const language of ["en", "hi", "hinglish", "mr"] as const) {
      const message = reviewRequestMessage({ language, businessName: "Sharma Sweets", link });
      expect(message).toContain("Sharma Sweets");
      expect(message.endsWith(link)).toBe(true);
    }
    expect(reviewRequestMessage({ language: "hi", businessName: "X", link })).toContain("धन्यवाद");
    expect(reviewRequestMessage({ language: "mr", businessName: "X", link })).toContain("धन्यवाद");
  });

  it("greets the customer by name when given", () => {
    expect(reviewRequestMessage({ language: "en", businessName: "X", link, customerName: " Priya " })).toMatch(/^Hi Priya!/);
    expect(reviewRequestMessage({ language: "hi", businessName: "X", link, customerName: "Rahul" })).toContain("Rahul जी");
    expect(reviewRequestMessage({ language: "en", businessName: "X", link })).toMatch(/^Hi!/);
  });

  it("follows Google's rules: no incentives, no asking for 5 stars", () => {
    for (const language of ["en", "hi", "hinglish", "mr"] as const) {
      const message = reviewRequestMessage({ language, businessName: "X", link }).toLowerCase();
      expect(message).not.toMatch(/discount|offer|free|gift|5 star|five star|★/);
    }
  });
});

describe("normalizeIndianPhone", () => {
  it("accepts common ways of typing an Indian mobile number", () => {
    expect(normalizeIndianPhone("98765 43210")).toBe("919876543210");
    expect(normalizeIndianPhone("+91-98765-43210")).toBe("919876543210");
    expect(normalizeIndianPhone("09876543210")).toBe("919876543210");
    expect(normalizeIndianPhone("0091 9876543210")).toBe("919876543210");
  });

  it("rejects numbers that cannot be Indian mobiles", () => {
    expect(normalizeIndianPhone("12345 67890")).toBeNull();
    expect(normalizeIndianPhone("020 2567 8901")).toBeNull();
    expect(normalizeIndianPhone("123")).toBeNull();
    expect(normalizeIndianPhone("")).toBeNull();
  });

  it("allows international numbers", () => {
    expect(normalizeIndianPhone("+971 50 123 4567")).toBe("971501234567");
  });
});

describe("whatsappLink", () => {
  it("encodes the message, with or without a number", () => {
    expect(whatsappLink("Hi there & thanks\nlink", "919876543210")).toBe("https://wa.me/919876543210?text=Hi%20there%20%26%20thanks%0Alink");
    expect(whatsappLink("Hi")).toBe("https://wa.me/?text=Hi");
  });
});

describe("shortReviewLink", () => {
  it("joins without double slashes", () => {
    expect(shortReviewLink("https://app.example.in/", "abc")).toBe("https://app.example.in/r/abc");
  });
});

describe("validateCustomReviewUrl", () => {
  it("accepts Google review links", () => {
    for (const url of [
      "https://g.page/r/CbX123abc/review",
      "https://maps.app.goo.gl/AbCdEf",
      "https://search.google.com/local/writereview?placeid=ChIJ123",
      "https://www.google.co.in/maps/place/x",
    ]) {
      expect(validateCustomReviewUrl(url).ok).toBe(true);
    }
  });

  it("treats empty as 'use Google's link'", () => {
    expect(validateCustomReviewUrl("  ")).toEqual({ ok: true, url: null });
  });

  it("rejects non-Google, http and malformed links", () => {
    expect(validateCustomReviewUrl("https://evil.example/review").ok).toBe(false);
    expect(validateCustomReviewUrl("https://google.com.evil.example/x").ok).toBe(false);
    expect(validateCustomReviewUrl("http://g.page/r/x").ok).toBe(false);
    expect(validateCustomReviewUrl("not a link").ok).toBe(false);
  });
});
