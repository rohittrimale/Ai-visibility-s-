import type { ScoredResult } from "./scoring";
import { calculateScore } from "./scoring";
import { engineLabel } from "./providers";

type Ctx = { businessName: string; domain: string; city: string; category: string };

/** Rule-based, plain-English tips ranked by likely impact. Returns 3-5. */
export function buildTips(results: ScoredResult[], ctx: Ctx): string[] {
  const valid = results.filter((r) => r.parsed);
  const summary = calculateScore(results);
  const tips: { w: number; text: string }[] = [];

  const sources = new Map<string, number>();
  for (const r of valid) for (const s of r.parsed!.sources) {
    const d = s.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
    if (d && d !== ctx.domain) sources.set(d, (sources.get(d) ?? 0) + 1);
  }
  const topSources = [...sources.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d]) => d);
  const siteCited = valid.some((r) => r.parsed!.sources.some((s) => s.toLowerCase().includes(ctx.domain)));
  const negative = valid.filter((r) => r.parsed!.sentiment === "negative").length;
  const weakEngines = Object.entries(summary.perEngine).filter(([, v]) => v.score < 25).map(([k]) => engineLabel(k));

  if (summary.score < 40)
    tips.push({
      w: 10,
      text: `Claim and fully complete your Google Business Profile for ${ctx.businessName}: correct category, ${ctx.city} address, hours, photos and services. AI assistants lean heavily on it for local recommendations.`,
    });
  if (topSources.length)
    tips.push({
      w: 9,
      text: `AI answers cite sites like ${topSources.join(", ")}. Make sure ${ctx.businessName} has an accurate, detailed listing or a few recent reviews on these.`,
    });
  if (!siteCited)
    tips.push({
      w: 8,
      text: `Your website wasn't cited. Add a page that clearly says what you do and where (e.g. "${ctx.category} in ${ctx.city}"), plus an FAQ answering the questions customers actually ask.`,
    });
  tips.push({
    w: 7,
    text: `Ask happy customers for Google reviews that mention the service and the area ("great ${ctx.category} in ${ctx.city}"). Review volume and wording strongly influence who gets recommended.`,
  });
  if (weakEngines.length)
    tips.push({
      w: 6,
      text: `You're nearly invisible on ${weakEngines.join(" and ")}. Perplexity and Gemini use live web results, so fresh, well-structured pages and local directory listings help most there.`,
    });
  if (negative > 0)
    tips.push({
      w: 8,
      text: `Some answers described you negatively. Read your recent reviews, reply publicly to complaints, and fix recurring issues; AI summaries pick up on review themes.`,
    });
  if (summary.score >= 40)
    tips.push({
      w: 5,
      text: `You're mentioned, but often not first. Add schema markup (LocalBusiness) and consistent name/address/phone across the web to move up the list.`,
    });
  tips.push({
    w: 1,
    text: `Re-check monthly. AI answers change often, so tracking your score over time shows whether your changes are working.`,
  });

  return tips.sort((a, b) => b.w - a.w).slice(0, 5).map((t) => t.text);
}
