import { describe, expect, it } from "vitest";
import { heuristicParse } from "@/lib/parser";

const ctx = { brand: "Smile Dental", domain: "smiledental.com", competitors: ["Rival Clinic"] };

describe("heuristicParse", () => {
  it("finds position in a numbered list and competitors", () => {
    const a = "1. **Rival Clinic** - great\n2. **Smile Dental** - the best choice\n3. **Other Care** - ok\nSee https://reviews.com/x";
    const p = heuristicParse(a, ctx);
    expect(p.brand_mentioned).toBe(true);
    expect(p.position).toBe(2);
    expect(p.sentiment).toBe("positive");
    expect(p.competitors_mentioned).toEqual(expect.arrayContaining(["Rival Clinic", "Other Care"]));
    expect(p.competitors_mentioned).not.toContain("Smile Dental");
    expect(p.sources).toContain("https://reviews.com/x");
  });
  it("detects not mentioned", () => {
    const p = heuristicParse("1. **Other Care**\n2. **Rival Clinic**", ctx);
    expect(p).toMatchObject({ brand_mentioned: false, position: null, sentiment: "neutral" });
  });
  it("mentioned in prose has null position", () => {
    expect(heuristicParse("You could try Smile Dental in town.", ctx)).toMatchObject({ brand_mentioned: true, position: null });
  });
  it("does not match partial words", () => {
    expect(heuristicParse("Smile Dentalcare Plus is nice", ctx).brand_mentioned).toBe(false);
  });
});
