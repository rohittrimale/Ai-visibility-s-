import type { Parsed } from "../scoring";

export type BusinessRow = {
  id: string;
  user_id: string | null;
  name: string;
  website: string;
  city: string;
  category: string;
  competitors: string[];
  tracked: boolean;
  created_at: string;
};

export type Report = {
  mentionedCount: number;
  totalCount: number;
  topCompetitors: { name: string; count: number }[];
  tips: string[];
  engines: string[];
  /** Deep Audit only: week-by-week action plan. */
  plan?: PlanWeek[];
};

export type PlanWeek = { week: number; title: string; items: string[] };

export type CheckRow = {
  id: string;
  business_id: string;
  status: "running" | "done" | "failed";
  source: "free" | "manual" | "weekly" | "audit";
  score: number | null;
  engine_scores: Record<string, { score: number; mentioned: number; total: number }> | null;
  report: Report | null;
  unlocked: boolean;
  ip_hash: string | null;
  created_at: string;
};

export type PromptResultRow = {
  id?: string;
  check_id: string;
  engine: string;
  prompt: string;
  prompt_hash: string;
  raw_answer: string | null;
  parsed: Parsed | null;
  sources: string[];
  cached: boolean;
  error: string | null;
  created_at?: string;
};

export type UsageRow = {
  check_id: string | null;
  engine: string;
  kind: "answer" | "parse";
  cost_usd: number;
  cached: boolean;
};

export type LeadRow = { email: string; business_id: string; check_id: string };

/** One-time paid Deep Audit, bought from a free check's results page. */
export type AuditRow = {
  id: string;
  check_id: string; // the free check it was bought from
  email: string;
  amount_inr: number;
  status: "pending" | "paid" | "running" | "done" | "failed";
  payment_link_id: string | null;
  audit_check_id: string | null; // the deep check, once run
  paid_at: string | null;
  updated_at: string;
  created_at: string;
};

export type TrackedBusiness = BusinessRow & { plan: "free" | "starter" | "growth"; prompts: string[] };

/**
 * Everything the app needs from persistence. Two implementations:
 * Supabase (production) and in-memory (local dev / tests without Supabase).
 */
export interface Store {
  readonly kind: "supabase" | "memory";
  createBusiness(b: Omit<BusinessRow, "id" | "created_at" | "tracked" | "user_id"> & { user_id?: string | null }): Promise<BusinessRow>;
  getBusiness(id: string): Promise<BusinessRow | null>;
  createCheck(c: { business_id: string; source: CheckRow["source"]; ip_hash: string | null }): Promise<CheckRow>;
  updateCheck(id: string, patch: Partial<Omit<CheckRow, "id">>): Promise<void>;
  getCheck(id: string): Promise<CheckRow | null>;
  insertPromptResults(rows: PromptResultRow[]): Promise<void>;
  listPromptResults(checkId: string): Promise<PromptResultRow[]>;
  /** Raw answer for the same engine+prompt within the TTL, from any earlier check. */
  findCachedAnswer(engine: string, promptHash: string, sinceIso: string): Promise<{ raw_answer: string; sources: string[] } | null>;
  /** Atomically count a hit; returns false when over `limit` for today. */
  hitRateLimit(key: string, limit: number): Promise<boolean>;
  /** Atomically reserve spend for the month; false if it would exceed `cap`. */
  reserveSpend(month: string, amount: number, cap: number): Promise<boolean>;
  addSpend(month: string, delta: number): Promise<void>;
  getSpend(month: string): Promise<number>;
  logUsage(rows: UsageRow[]): Promise<void>;
  upsertLead(l: LeadRow): Promise<void>;
  latestCheckDate(businessId: string): Promise<string | null>;
  /** Paid: businesses with weekly tracking on a paid plan. */
  listTrackedBusinesses(): Promise<TrackedBusiness[]>;

  // ---- one-time Deep Audit ----
  createAudit(a: { check_id: string; email: string; amount_inr: number }): Promise<AuditRow>;
  getAudit(id: string): Promise<AuditRow | null>;
  updateAudit(id: string, patch: Partial<Pick<AuditRow, "payment_link_id" | "audit_check_id" | "status">>): Promise<void>;
  /** Atomically move an audit from one of `from` to `to`. Returns false if it was in another state (idempotency guard). */
  transitionAudit(id: string, from: AuditRow["status"][], to: AuditRow["status"]): Promise<boolean>;
  /** Paid audits that never finished: status 'paid', or 'running' with no progress for 15+ minutes. */
  listAuditsToRun(): Promise<AuditRow[]>;
}
