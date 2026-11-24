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
};

export type CheckRow = {
  id: string;
  business_id: string;
  status: "running" | "done" | "failed";
  source: "free" | "manual" | "weekly";
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
}
