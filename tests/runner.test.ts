import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryStore } from "@/lib/store/memory";
import { runCheck } from "@/lib/runner";
import { generatePrompts } from "@/lib/prompts";
import { ALL_PROVIDERS, enabledProviders } from "@/lib/providers";
import type { Provider } from "@/lib/providers";
import { allowEmail, allowIp, reserveBudget, settleBudget, monthKey } from "@/lib/limits";

const biz = { name: "Smile Dental", website: "https://smile.com", city: "Pune", category: "dentist", competitors: ["Rival"] };

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("AI_MOCK", "1");
});

describe("runCheck (mock engines)", () => {
  it("runs 8 prompts x 3 engines, scores and saves", async () => {
    const store = createMemoryStore();
    const business = await store.createBusiness(biz);
    const check = await store.createCheck({ business_id: business.id, source: "free", ip_hash: "h" });
    const out = await runCheck({ store, checkId: check.id, business, prompts: generatePrompts(business), providers: enabledProviders() });
    expect(out.ok).toBe(true);
    const saved = await store.getCheck(check.id);
    expect(saved?.status).toBe("done");
    expect(saved?.score).toBeGreaterThanOrEqual(0);
    expect(Object.keys(saved!.engine_scores!).sort()).toEqual(["gemini", "openai", "perplexity"]);
    expect(saved!.report!.tips.length).toBeGreaterThanOrEqual(3);
    expect((await store.listPromptResults(check.id)).length).toBe(24);
  });

  it("can disable one provider via env var", () => {
    vi.stubEnv("ENABLE_GEMINI", "0");
    expect(enabledProviders().map((p) => p.id)).toEqual(["openai", "perplexity"]);
  });

  it("disables a provider with no key when not mocking", () => {
    vi.stubEnv("AI_MOCK", "0");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("PERPLEXITY_API_KEY", "k");
    expect(enabledProviders().map((p) => p.id)).toEqual(["perplexity"]);
  });

  it("survives one engine failing and excludes it from the score", async () => {
    const store = createMemoryStore();
    const business = await store.createBusiness(biz);
    const check = await store.createCheck({ business_id: business.id, source: "free", ip_hash: null });
    const broken: Provider = { ...ALL_PROVIDERS[1], ask: async () => { throw new Error("boom"); } };
    await runCheck({ store, checkId: check.id, business, prompts: generatePrompts(business), providers: [ALL_PROVIDERS[0], broken] });
    const saved = await store.getCheck(check.id);
    expect(saved?.status).toBe("done");
    expect(Object.keys(saved!.engine_scores!)).toEqual(["openai"]);
  });

  it("marks the check failed when every call fails", async () => {
    const store = createMemoryStore();
    const business = await store.createBusiness(biz);
    const check = await store.createCheck({ business_id: business.id, source: "free", ip_hash: null });
    const broken: Provider = { ...ALL_PROVIDERS[0], ask: async () => { throw new Error("boom"); } };
    const out = await runCheck({ store, checkId: check.id, business, prompts: ["a"], providers: [broken] });
    expect(out.ok).toBe(false);
    expect((await store.getCheck(check.id))?.status).toBe("failed");
  });

  it("serves identical prompts from the 24h cache (real mode, no second API call)", async () => {
    vi.stubEnv("AI_MOCK", "0");
    vi.stubEnv("OPENAI_API_KEY", ""); // parser falls back to heuristic
    const store = createMemoryStore();
    const ask = vi.fn(async () => ({ text: "1. **Smile Dental**", sources: [], costUsd: 0.01 }));
    const fake: Provider = { id: "openai", label: "x", isEnabled: () => true, ask };
    for (let i = 0; i < 2; i++) {
      const business = await store.createBusiness({ ...biz, name: i ? "Other Name" : "Smile Dental" });
      const check = await store.createCheck({ business_id: business.id, source: "free", ip_hash: null });
      await runCheck({ store, checkId: check.id, business, prompts: ["best dentist in Pune"], providers: [fake] });
    }
    expect(ask).toHaveBeenCalledTimes(1);
    const dump = store._dump() as { results: { cached: boolean; parsed: { brand_mentioned: boolean } }[] };
    expect(dump.results[1].cached).toBe(true);
    expect(dump.results[0].parsed.brand_mentioned).toBe(true);
    expect(dump.results[1].parsed.brand_mentioned).toBe(false); // re-parsed for the new brand
  });
});

describe("abuse controls", () => {
  it("allows 2 per IP per day then blocks", async () => {
    const s = createMemoryStore();
    expect(await allowIp(s, "1.1.1.1")).toBe(true);
    expect(await allowIp(s, "1.1.1.1")).toBe(true);
    expect(await allowIp(s, "1.1.1.1")).toBe(false);
    expect(await allowIp(s, "2.2.2.2")).toBe(true);
  });
  it("allows 2 per email per day (case-insensitive)", async () => {
    const s = createMemoryStore();
    expect(await allowEmail(s, "A@b.com")).toBe(true);
    expect(await allowEmail(s, "a@b.com")).toBe(true);
    expect(await allowEmail(s, "a@B.com")).toBe(false);
  });
  it("stops reserving once the monthly cap is hit", async () => {
    vi.stubEnv("MONTHLY_SPEND_CAP_USD", "0.30");
    vi.stubEnv("EST_COST_PER_CHECK_USD", "0.10");
    const s = createMemoryStore();
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await reserveBudget(s));
    expect(results).toEqual([true, true, true, false]);
    await settleBudget(s, 0.02); // actual cost lower than estimate frees budget
    expect(await s.getSpend(monthKey())).toBeCloseTo(0.22);
    expect(await reserveBudget(s)).toBe(false); // 0.22 + 0.10 > 0.30
    await settleBudget(s, 0.02);
    expect(await reserveBudget(s)).toBe(true);
  });
});
