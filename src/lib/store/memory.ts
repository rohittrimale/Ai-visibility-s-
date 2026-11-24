import { randomUUID } from "node:crypto";
import type { BusinessRow, CheckRow, LeadRow, PromptResultRow, Store, UsageRow } from "./types";

const today = () => new Date().toISOString().slice(0, 10);

/** Non-persistent store for local development and tests. Not for production. */
export function createMemoryStore(): Store & { _dump(): Record<string, unknown> } {
  const businesses = new Map<string, BusinessRow>();
  const checks = new Map<string, CheckRow>();
  const results: PromptResultRow[] = [];
  const limits = new Map<string, number>();
  const spend = new Map<string, number>();
  const usage: UsageRow[] = [];
  const leads = new Map<string, LeadRow>();

  return {
    kind: "memory",
    async createBusiness(b) {
      const row: BusinessRow = { ...b, user_id: b.user_id ?? null, id: randomUUID(), tracked: false, created_at: new Date().toISOString() };
      businesses.set(row.id, row);
      return row;
    },
    async getBusiness(id) {
      return businesses.get(id) ?? null;
    },
    async createCheck(c) {
      const row: CheckRow = {
        id: randomUUID(), status: "running", score: null, engine_scores: null, report: null,
        unlocked: false, created_at: new Date().toISOString(), ...c,
      };
      checks.set(row.id, row);
      return row;
    },
    async updateCheck(id, patch) {
      const cur = checks.get(id);
      if (cur) checks.set(id, { ...cur, ...patch });
    },
    async getCheck(id) {
      return checks.get(id) ?? null;
    },
    async insertPromptResults(rows) {
      results.push(...rows.map((r) => ({ ...r, id: randomUUID(), created_at: new Date().toISOString() })));
    },
    async listPromptResults(checkId) {
      return results.filter((r) => r.check_id === checkId);
    },
    async findCachedAnswer(engine, promptHash, sinceIso) {
      const hit = [...results].reverse().find(
        (r) => r.engine === engine && r.prompt_hash === promptHash && !r.error && !!r.raw_answer && (r.created_at ?? "") >= sinceIso,
      );
      return hit ? { raw_answer: hit.raw_answer!, sources: hit.sources } : null;
    },
    async hitRateLimit(key, limit) {
      const k = `${key}|${today()}`;
      const n = (limits.get(k) ?? 0) + 1;
      if (n > limit) return false;
      limits.set(k, n);
      return true;
    },
    async reserveSpend(month, amount, cap) {
      const cur = spend.get(month) ?? 0;
      if (cur + amount > cap + 1e-9) return false;
      spend.set(month, cur + amount);
      return true;
    },
    async addSpend(month, delta) {
      spend.set(month, Math.max(0, (spend.get(month) ?? 0) + delta));
    },
    async getSpend(month) {
      return spend.get(month) ?? 0;
    },
    async logUsage(rows) {
      usage.push(...rows);
    },
    async upsertLead(l) {
      leads.set(`${l.email}|${l.check_id}`, l);
    },
    async latestCheckDate(businessId) {
      const c = [...checks.values()].filter((x) => x.business_id === businessId && x.status === "done").map((x) => x.created_at).sort();
      return c.at(-1) ?? null;
    },
    async listTrackedBusinesses() {
      return [];
    },
    _dump: () => ({ businesses: [...businesses.values()], checks: [...checks.values()], results, usage, leads: [...leads.values()], spend: [...spend] }),
  };
}
