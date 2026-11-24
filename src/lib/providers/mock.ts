import { createHash } from "node:crypto";
import type { AnswerResult, AskContext, EngineId } from "./types";

const FAKE = ["Sunrise Care", "Metro Choice", "Heritage Point", "Urban Edge", "Blue Orchid", "Prime Circle"];

/** Deterministic fake answer so the full flow can be tested with no API keys. */
export function mockAnswer(engine: EngineId, prompt: string, ctx?: AskContext): AnswerResult {
  const h = createHash("sha256").update(engine + prompt).digest();
  const brand = ctx?.mock?.brand ?? "";
  const names = [...FAKE].sort((a, b) => (h[a.length] % 3) - 1 || a.localeCompare(b)).slice(0, 4);
  for (const c of ctx?.mock?.competitors ?? []) if (h[c.length % 32] % 2 === 0) names.splice(1, 0, c);

  // ~45% of the time the brand appears, at a position derived from the hash.
  if (brand && h[0] % 100 < 45) names.splice(h[1] % 4, 0, brand);

  const list = names.slice(0, 5).map((n, i) => `${i + 1}. **${n}** - well reviewed locally.`).join("\n");
  return {
    text: `Here are some options:\n${list}\n\nSources: example-directory.com`,
    sources: engine === "perplexity" ? ["https://example-directory.com/list", "https://reviews.example.org/top"] : [],
    costUsd: 0,
  };
}
