export type Sentiment = "positive" | "neutral" | "negative";

export type Parsed = {
  brand_mentioned: boolean;
  position: number | null;
  sentiment: Sentiment;
  competitors_mentioned: string[];
  sources: string[];
};

export type ScoredResult = {
  engine: string;
  prompt: string;
  parsed: Parsed | null; // null = the engine call failed; excluded from scoring
};

/** Credit for being mentioned, higher when listed earlier. */
export function positionWeight(position: number | null): number {
  if (position === null) return 0.5; // mentioned, but not in a ranked list
  if (position <= 1) return 1;
  if (position === 2) return 0.85;
  if (position === 3) return 0.7;
  if (position === 4) return 0.55;
  if (position === 5) return 0.4;
  return 0.3;
}

const resultScore = (p: Parsed) => (p.brand_mentioned ? positionWeight(p.position) : 0);

export type ScoreSummary = {
  score: number; // 0-100 overall
  perEngine: Record<string, { score: number; mentioned: number; total: number }>;
  mentionedCount: number;
  totalCount: number;
};

export function calculateScore(results: ScoredResult[]): ScoreSummary {
  const valid = results.filter((r): r is ScoredResult & { parsed: Parsed } => r.parsed !== null);
  const engines = [...new Set(valid.map((r) => r.engine))];

  const perEngine: ScoreSummary["perEngine"] = {};
  for (const e of engines) {
    const rs = valid.filter((r) => r.engine === e);
    const sum = rs.reduce((a, r) => a + resultScore(r.parsed), 0);
    perEngine[e] = {
      score: Math.round((sum / rs.length) * 100),
      mentioned: rs.filter((r) => r.parsed.brand_mentioned).length,
      total: rs.length,
    };
  }
  // Equal weight per engine so an engine with more successful calls doesn't dominate.
  const score = engines.length
    ? Math.round(engines.reduce((a, e) => a + perEngine[e].score, 0) / engines.length)
    : 0;

  return {
    score,
    perEngine,
    mentionedCount: valid.filter((r) => r.parsed.brand_mentioned).length,
    totalCount: valid.length,
  };
}

export function topCompetitors(results: ScoredResult[], limit = 5, exclude: string[] = []) {
  const skip = new Set(exclude.map((e) => e.toLowerCase()));
  const counts = new Map<string, { name: string; count: number }>();
  for (const r of results) {
    for (const raw of r.parsed?.competitors_mentioned ?? []) {
      const key = raw.trim().toLowerCase();
      if (!key || skip.has(key)) continue;
      const cur = counts.get(key) ?? { name: raw.trim(), count: 0 };
      cur.count++;
      counts.set(key, cur);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

export const scoreLabel = (s: number) =>
  s >= 70 ? "Strong" : s >= 40 ? "Moderate" : s >= 15 ? "Weak" : "Barely visible";
