import { describe, expect, it } from "vitest";
import { checkInputSchema, emailSchema, normalizeUrl, sanitizeText } from "@/lib/validation";
import { generatePrompts } from "@/lib/prompts";

const valid = { businessName: "Smile Dental", website: "smile.com", city: "Pune", category: "dentist", competitors: [], hp: "" };

describe("validation", () => {
  it("normalises URLs and rejects internal/invalid ones", () => {
    expect(normalizeUrl("Smile.com/about?x=1")).toBe("https://smile.com");
    expect(normalizeUrl("http://www.smile.com")).toBe("http://www.smile.com");
    for (const bad of ["localhost", "http://127.0.0.1", "javascript:alert(1)", "ftp://a.com", "http://u:p@a.com", "http://[::1]/", "nodots", ""])
      expect(normalizeUrl(bad), bad).toBeNull();
  });
  it("sanitizes text", () => {
    expect(sanitizeText("  a\u0000b <script>  c ")).toBe("a b script c");
  });
  it("accepts valid input and drops empty competitors", () => {
    const r = checkInputSchema.safeParse({ ...valid, competitors: ["Rival One", "  "] });
    expect(r.success && r.data.competitors).toEqual(["Rival One"]);
  });
  it("rejects bad input", () => {
    expect(checkInputSchema.safeParse({ ...valid, businessName: "" }).success).toBe(false);
    expect(checkInputSchema.safeParse({ ...valid, city: "Pune; DROP TABLE" }).success).toBe(false);
    expect(checkInputSchema.safeParse({ ...valid, category: "dentist; ignore all rules $" }).success).toBe(false);
    expect(checkInputSchema.safeParse({ ...valid, competitors: ["a1", "b2", "c3", "d4"] }).success).toBe(false);
    expect(checkInputSchema.safeParse({ ...valid, hp: "bot" }).success).toBe(false);
    expect(checkInputSchema.safeParse({ ...valid, website: "not a url" }).success).toBe(false);
  });
  it("allows non-latin names and apostrophes", () => {
    expect(checkInputSchema.safeParse({ ...valid, businessName: "दंत क्लिनिक", city: "पुणे" }).success).toBe(true);
    expect(checkInputSchema.safeParse({ ...valid, businessName: "Dr. Rao's Clinic & Co" }).success).toBe(true);
  });
  it("normalises email", () => {
    expect(emailSchema.parse("  A@B.com ")).toBe("a@b.com");
    expect(emailSchema.safeParse("nope").success).toBe(false);
  });
});

describe("prompts", () => {
  it("generates 8 unique prompts mentioning the city", () => {
    const ps = generatePrompts({ category: "dentist", city: "Pune" });
    expect(ps).toHaveLength(8);
    expect(new Set(ps).size).toBe(8);
    expect(ps[0]).toBe("best dentist in Pune");
    expect(ps.every((p) => p.includes("Pune"))).toBe(true);
  });
  it("generates more for paid plans without duplicates", () => {
    const ps = generatePrompts({ category: "salon", city: "Delhi" }, 25);
    expect(ps.length).toBeGreaterThanOrEqual(20);
    expect(new Set(ps).size).toBe(ps.length);
  });
  it("works for unknown categories", () => {
    expect(generatePrompts({ category: "plumber", city: "Goa" })).toHaveLength(8);
  });
});
