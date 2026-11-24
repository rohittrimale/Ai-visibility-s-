import { createHash } from "node:crypto";
import { config } from "./config";
import { hostOf } from "./validation";
import { parseAnswer } from "./parser";
import type { Provider } from "./providers";
import { calculateScore, topCompetitors, type ScoredResult } from "./scoring";
import type { BusinessRow, PromptResultRow, Report, Store, UsageRow } from "./store/types";
import { buildTips } from "./tips";

const CONCURRENCY = 8;

export const promptHash = (prompt: string) =>
  createHash("sha256").update(prompt.toLowerCase().replace(/\s+/g, " ").trim()).digest("hex").slice(0, 32);

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

export type RunOutcome = { ok: boolean; costUsd: number; score: number | null };

/**
 * Runs every prompt on every enabled engine, parses each answer, scores, and saves the check.
 * Never throws for provider failures: a failed call is stored with an error and excluded from the score.
 */
export async function runCheck(opts: {
  store: Store;
  checkId: string;
  business: BusinessRow;
  prompts: string[];
  providers: Provider[];
  deadlineMs?: number; // stop starting new calls after this many ms
}): Promise<RunOutcome> {
  const { store, checkId, business, prompts, providers } = opts;
  const started = Date.now();
  const deadline = opts.deadlineMs ?? 50_000;
  const domain = hostOf(business.website);
  const sinceIso = new Date(Date.now() - config.cacheTtlHours * 3600_000).toISOString();

  const rows: PromptResultRow[] = [];
  const usage: UsageRow[] = [];
  const scored: ScoredResult[] = [];
  let costUsd = 0;

  const tasks = providers.flatMap((p) => prompts.map((prompt) => ({ p, prompt })));

  await pool(tasks, CONCURRENCY, async ({ p, prompt }) => {
    const hash = promptHash(prompt);
    const base = { check_id: checkId, engine: p.id, prompt, prompt_hash: hash };
    if (Date.now() - started > deadline) {
      rows.push({ ...base, raw_answer: null, parsed: null, sources: [], cached: false, error: "timeout", });
      scored.push({ engine: p.id, prompt, parsed: null });
      return;
    }
    try {
      // 24h cache of raw answers (the prompt text is brand-agnostic, so it is safe to share)
      let answer: { raw_answer: string; sources: string[] } | null = null;
      let cached = false;
      if (!config.mock) {
        answer = await store.findCachedAnswer(p.id, hash, sinceIso);
        cached = !!answer;
      }
      if (!answer) {
        const r = await p.ask(prompt, { mock: { brand: business.name, competitors: business.competitors } });
        answer = { raw_answer: r.text, sources: r.sources };
        costUsd += r.costUsd;
        usage.push({ check_id: checkId, engine: p.id, kind: "answer", cost_usd: r.costUsd, cached: false });
      } else {
        usage.push({ check_id: checkId, engine: p.id, kind: "answer", cost_usd: 0, cached: true });
      }
      const parsedRes = await parseAnswer(
        answer.raw_answer,
        { brand: business.name, domain, competitors: business.competitors },
        answer.sources,
      );
      costUsd += parsedRes.costUsd;
      usage.push({ check_id: checkId, engine: p.id, kind: "parse", cost_usd: parsedRes.costUsd, cached: false });
      rows.push({ ...base, raw_answer: answer.raw_answer, parsed: parsedRes.parsed, sources: answer.sources, cached, error: null });
      scored.push({ engine: p.id, prompt, parsed: parsedRes.parsed });
    } catch (e) {
      rows.push({ ...base, raw_answer: null, parsed: null, sources: [], cached: false, error: e instanceof Error ? e.message.slice(0, 200) : "error" });
      scored.push({ engine: p.id, prompt, parsed: null });
    }
  });

  await store.insertPromptResults(rows);
  await store.logUsage(usage);

  const summary = calculateScore(scored);
  if (summary.totalCount === 0) {
    await store.updateCheck(checkId, { status: "failed" });
    return { ok: false, costUsd, score: null };
  }
  const report: Report = {
    mentionedCount: summary.mentionedCount,
    totalCount: summary.totalCount,
    topCompetitors: topCompetitors(scored, 5, [business.name]),
    tips: buildTips(scored, { businessName: business.name, domain, city: business.city, category: business.category }),
    engines: providers.map((p) => p.id),
  };
  await store.updateCheck(checkId, { status: "done", score: summary.score, engine_scores: summary.perEngine, report });
  return { ok: true, costUsd, score: summary.score };
}
