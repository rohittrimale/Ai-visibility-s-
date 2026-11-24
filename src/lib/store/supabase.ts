import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BusinessRow, CheckRow, PromptResultRow, Store, TrackedBusiness } from "./types";

/** Server-only client using the service-role key (bypasses RLS). Never import in client code. */
export function serviceClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error || res.data === null) throw new Error(`Supabase ${what} failed: ${res.error?.message ?? "no data"}`);
  return res.data;
}

export function createSupabaseStore(db: SupabaseClient = serviceClient()): Store {
  return {
    kind: "supabase",
    async createBusiness(b) {
      return must(await db.from("businesses").insert(b).select().single(), "createBusiness") as BusinessRow;
    },
    async getBusiness(id) {
      const { data } = await db.from("businesses").select().eq("id", id).maybeSingle();
      return (data as BusinessRow) ?? null;
    },
    async createCheck(c) {
      return must(await db.from("checks").insert(c).select().single(), "createCheck") as CheckRow;
    },
    async updateCheck(id, patch) {
      must(await db.from("checks").update(patch).eq("id", id).select("id"), "updateCheck");
    },
    async getCheck(id) {
      const { data } = await db.from("checks").select().eq("id", id).maybeSingle();
      return (data as CheckRow) ?? null;
    },
    async insertPromptResults(rows) {
      if (!rows.length) return;
      must(await db.from("prompt_results").insert(rows).select("id"), "insertPromptResults");
    },
    async listPromptResults(checkId) {
      return must(await db.from("prompt_results").select().eq("check_id", checkId).order("created_at"), "listPromptResults") as PromptResultRow[];
    },
    async findCachedAnswer(engine, promptHash, sinceIso) {
      const { data } = await db
        .from("prompt_results")
        .select("raw_answer, sources")
        .eq("engine", engine)
        .eq("prompt_hash", promptHash)
        .is("error", null)
        .not("raw_answer", "is", null)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ? { raw_answer: data.raw_answer as string, sources: (data.sources as string[]) ?? [] } : null;
    },
    async hitRateLimit(key, limit) {
      return must(await db.rpc("hit_rate_limit", { p_key: key, p_limit: limit }), "hitRateLimit") as boolean;
    },
    async reserveSpend(month, amount, cap) {
      return must(await db.rpc("reserve_spend", { p_month: month, p_amount: amount, p_cap: cap }), "reserveSpend") as boolean;
    },
    async addSpend(month, delta) {
      must(await db.rpc("add_spend", { p_month: month, p_delta: delta }), "addSpend");
    },
    async getSpend(month) {
      const { data } = await db.from("spend_counters").select("spent_usd").eq("month", month).maybeSingle();
      return Number(data?.spent_usd ?? 0);
    },
    async logUsage(rows) {
      if (!rows.length) return;
      must(await db.from("usage_log").insert(rows).select("id"), "logUsage");
    },
    async upsertLead(l) {
      must(await db.from("leads").upsert(l, { onConflict: "email,check_id" }).select("id"), "upsertLead");
    },
    async latestCheckDate(businessId) {
      const { data } = await db.from("checks").select("created_at").eq("business_id", businessId).eq("status", "done")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      return (data?.created_at as string) ?? null;
    },
    async listTrackedBusinesses() {
      const { data, error } = await db
        .from("businesses")
        .select("*, users!inner(plan), business_prompts(prompt)")
        .eq("tracked", true)
        .in("users.plan", ["starter", "growth"]);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r: any) => {
        const { users, business_prompts, ...b } = r;
        return { ...b, plan: users.plan, prompts: (business_prompts ?? []).map((p: any) => p.prompt) } as TrackedBusiness;
      });
    },
  };
}
