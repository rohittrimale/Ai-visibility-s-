import { describe, expect, it } from "vitest";
import { calculateScore, positionWeight, topCompetitors, type ScoredResult, type Parsed } from "@/lib/scoring";
import { buildTips } from "@/lib/tips";

const p = (o: Partial<Parsed> = {}): Parsed => ({
  brand_mentioned: false, position: null, sentiment: "neutral", competitors_mentioned: [], sources: [], ...o,
});
const r = (engine: string, parsed: Parsed | null): ScoredResult => ({ engine, prompt: "x", parsed });

describe("scoring", () => {
  it("weights earlier positions higher", () => {
    expect(positionWeight(1)).toBeGreaterThan(positionWeight(2));
    expect(positionWeight(3)).toBeGreaterThan(positionWeight(6));
    expect(positionWeight(null)).toBe(0.5);
  });
  it("is 0 when never mentioned and 100 when always first", () => {
    expect(calculateScore([r("a", p()), r("a", p())]).score).toBe(0);
    const first = p({ brand_mentioned: true, position: 1 });
    expect(calculateScore([r("a", first), r("b", first)]).score).toBe(100);
  });
  it("averages mentions and position within an engine", () => {
    const s = calculateScore([r("a", p({ brand_mentioned: true, position: 1 })), r("a", p()), r("a", p({ brand_mentioned: true, position: 3 })), r("a", p())]);
    expect(s.score).toBe(Math.round(((1 + 0.7) / 4) * 100));
    expect(s.perEngine.a).toMatchObject({ mentioned: 2, total: 4 });
  });
  it("ignores failed calls and weights engines equally", () => {
    const s = calculateScore([r("a", p({ brand_mentioned: true, position: 1 })), r("b", p()), r("b", null), r("c", null)]);
    expect(s.score).toBe(50);
    expect(s.perEngine.c).toBeUndefined();
    expect(s.totalCount).toBe(2);
  });
  it("returns 0 with no valid results", () => {
    expect(calculateScore([r("a", null)]).score).toBe(0);
  });
  it("ranks competitors and excludes the brand", () => {
    const res = [r("a", p({ competitors_mentioned: ["X", "Y"] })), r("b", p({ competitors_mentioned: ["x", "Me"] }))];
    expect(topCompetitors(res, 5, ["me"])).toEqual([{ name: "X", count: 2 }, { name: "Y", count: 1 }]);
  });
  it("returns 3-5 tips", () => {
    const tips = buildTips([r("a", p())], { businessName: "B", domain: "b.com", city: "Pune", category: "dentist" });
    expect(tips.length).toBeGreaterThanOrEqual(3);
    expect(tips.length).toBeLessThanOrEqual(5);
  });
});
