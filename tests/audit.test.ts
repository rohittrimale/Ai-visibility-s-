import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildActionPlan } from "@/lib/actionPlan";
import { runAudit } from "@/lib/audit";
import { auditMode, auditPriceInr, paidAuditFromEvent } from "@/lib/billing/audit";
import { generatePrompts } from "@/lib/prompts";
import { enabledProviders } from "@/lib/providers";
import { runCheck } from "@/lib/runner";
import { createMemoryStore } from "@/lib/store/memory";

const biz = { name: "Smile Dental", website: "https://smile.com", city: "Pune", category: "dentist", competitors: ["Rival"] };

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("AI_MOCK", "1");
});

async function paidAudit() {
  const store = createMemoryStore();
  const business = await store.createBusiness(biz);
  const free = await store.createCheck({ business_id: business.id, source: "free", ip_hash: "h" });
  await runCheck({ store, checkId: free.id, business, prompts: generatePrompts(business), providers: enabledProviders() });
  const audit = await store.createAudit({ check_id: free.id, email: "a@b.com", amount_inr: 999 });
  return { store, audit };
}

describe("Deep Audit", () => {
  it("only runs after payment, and only once", async () => {
    const { store, audit } = await paidAudit();
    expect(await runAudit(store, audit, enabledProviders())).toBe("skipped"); // still pending

    expect(await store.transitionAudit(audit.id, ["pending"], "paid")).toBe(true);
    expect(await store.transitionAudit(audit.id, ["pending"], "paid")).toBe(false); // webhook retry is a no-op

    const paid = (await store.getAudit(audit.id))!;
    const [a, b] = await Promise.all([runAudit(store, paid, enabledProviders()), runAudit(store, paid, enabledProviders())]);
    expect([a, b].sort()).toEqual(["done", "skipped"]);

    const done = (await store.getAudit(audit.id))!;
    expect(done.status).toBe("done");
    const deep = (await store.getCheck(done.audit_check_id!))!;
    expect(deep.source).toBe("audit");
    expect(deep.unlocked).toBe(true);
    expect(deep.report!.plan).toHaveLength(4);
    expect((await store.listPromptResults(deep.id)).length).toBe(30 * 3);
    expect(await store.listAuditsToRun()).toEqual([]);
  });

  it("marks the audit failed when no engine works", async () => {
    const { store, audit } = await paidAudit();
    await store.transitionAudit(audit.id, ["pending"], "paid");
    expect(await runAudit(store, (await store.getAudit(audit.id))!, [])).toBe("failed");
    expect((await store.getAudit(audit.id))!.status).toBe("failed");
  });

  it("parses only paid audit payment-link webhooks", () => {
    const evt = (notes: object, event = "payment_link.paid") => ({
      event, payload: { payment_link: { entity: { id: "plink_1", amount_paid: 99900, notes } } },
    });
    expect(paidAuditFromEvent(evt({ kind: "audit", audit_id: "x" }))).toEqual({ auditId: "x", paymentLinkId: "plink_1", amountPaidInr: 999 });
    expect(paidAuditFromEvent(evt({ kind: "other", audit_id: "x" }))).toBeNull();
    expect(paidAuditFromEvent(evt({ kind: "audit", audit_id: "x" }, "payment_link.cancelled"))).toBeNull();
    expect(paidAuditFromEvent({ event: "subscription.charged" })).toBeNull();
  });

  it("price and mode come from env", () => {
    expect(auditPriceInr()).toBe(999);
    vi.stubEnv("AUDIT_PRICE_INR", "1499");
    expect(auditPriceInr()).toBe(1499);
    vi.stubEnv("AUDIT_PRICE_INR", "-5");
    expect(auditPriceInr()).toBe(999);

    vi.stubEnv("RAZORPAY_KEY_ID", "");
    expect(auditMode()).toBe("dev");
    vi.stubEnv("NODE_ENV", "production");
    expect(auditMode()).toBe("off"); // never fake payments in production
    vi.stubEnv("RAZORPAY_KEY_ID", "k");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "s");
    expect(auditMode()).toBe("live");
    vi.stubEnv("AUDIT_ENABLED", "0");
    expect(auditMode()).toBe("off");
  });

  it("action plan names missed questions, cited sites and rivals", () => {
    const p = (brand: boolean, sources: string[] = []) => ({
      brand_mentioned: brand, position: brand ? 2 : null, sentiment: "neutral" as const, competitors_mentioned: [], sources,
    });
    const plan = buildActionPlan(
      [
        { engine: "openai", prompt: "best dentist in Pune", parsed: p(false, ["https://www.practo.com/pune"]) },
        { engine: "gemini", prompt: "best dentist in Pune", parsed: p(false) },
        { engine: "openai", prompt: "top rated dental clinic in Pune", parsed: p(true) },
        { engine: "gemini", prompt: "top rated dental clinic in Pune", parsed: p(false) },
      ],
      { businessName: "Smile Dental", domain: "smile.com", city: "Pune", category: "dentist" },
      [{ name: "Rival Dental", count: 3 }],
    );
    const text = JSON.stringify(plan);
    expect(plan.map((w) => w.week)).toEqual([1, 2, 3, 4]);
    expect(text).toContain("best dentist in Pune");
    expect(text).toContain("practo.com");
    expect(text).toContain("Rival Dental");
  });
});
