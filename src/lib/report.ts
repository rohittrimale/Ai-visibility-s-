import type { BusinessRow, CheckRow, PromptResultRow, Store } from "./store/types";

export type LoadedReport = { check: CheckRow; business: BusinessRow; results: PromptResultRow[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID.test(s);

export async function loadReport(store: Store, id: string): Promise<LoadedReport | null> {
  if (!isUuid(id)) return null;
  const check = await store.getCheck(id);
  if (!check || check.status !== "done") return null;
  const business = await store.getBusiness(check.business_id);
  if (!business) return null;
  return { check, business, results: await store.listPromptResults(id) };
}

/** Per-prompt view: which engines mentioned the business, and at what position. */
export function promptRows(results: PromptResultRow[]) {
  const byPrompt = new Map<string, Record<string, { mentioned: boolean; position: number | null } | null>>();
  for (const r of results) {
    const row = byPrompt.get(r.prompt) ?? {};
    row[r.engine] = r.parsed ? { mentioned: r.parsed.brand_mentioned, position: r.parsed.position } : null;
    byPrompt.set(r.prompt, row);
  }
  return [...byPrompt.entries()].map(([prompt, engines]) => ({
    prompt,
    engines,
    anyMentioned: Object.values(engines).some((e) => e?.mentioned),
  }));
}
