import type { Parsed } from "./scoring";
import type { PlanWeek } from "./store/types";

type Result = { engine: string; prompt: string; parsed: Parsed | null };
type Ctx = { businessName: string; domain: string; city: string; category: string };

const domainOf = (s: string) => s.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();

/**
 * Turns a Deep Audit's raw results into a concrete 4-week plan, specific to this business:
 * the exact questions it is missing, the sites AI engines cite, and the competitors that win instead.
 */
export function buildActionPlan(results: Result[], ctx: Ctx, competitors: { name: string; count: number }[]): PlanWeek[] {
  const valid = results.filter((r) => r.parsed);

  const byPrompt = new Map<string, { mentioned: number; total: number }>();
  for (const r of valid) {
    const v = byPrompt.get(r.prompt) ?? { mentioned: 0, total: 0 };
    v.total++;
    if (r.parsed!.brand_mentioned) v.mentioned++;
    byPrompt.set(r.prompt, v);
  }
  const missed = [...byPrompt.entries()].filter(([, v]) => v.mentioned === 0).map(([p]) => p);
  const weak = [...byPrompt.entries()].filter(([, v]) => v.mentioned > 0 && v.mentioned < v.total).map(([p]) => p);

  const sources = new Map<string, number>();
  for (const r of valid) for (const s of r.parsed!.sources) {
    const d = domainOf(s);
    if (d && d !== ctx.domain) sources.set(d, (sources.get(d) ?? 0) + 1);
  }
  const topSources = [...sources.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([d]) => d);
  const negative = valid.filter((r) => r.parsed!.brand_mentioned && r.parsed!.sentiment === "negative").length;
  const topRivals = competitors.slice(0, 3).map((c) => c.name);
  const quote = (p: string) => `“${p}”`;

  const week1 = [
    `Google Business Profile: set the primary category to "${ctx.category}", confirm the ${ctx.city} address, hours and phone, add 10+ recent photos and list every service you offer.`,
    `Make your business name, address and phone identical everywhere (website footer, Google, Facebook, Instagram, directories). Inconsistent details make AI assistants less confident about recommending you.`,
    `Add LocalBusiness schema markup to your homepage (name, address, phone, opening hours, geo, sameAs links to your profiles).`,
  ];
  const week2 = missed.length
    ? [
        `AI engines never mentioned you for these questions. Write one clear page or FAQ section answering each: ${missed.slice(0, 5).map(quote).join(", ")}.`,
        `On each page, say plainly what you do and where, e.g. "${ctx.businessName} is a ${ctx.category} in ${ctx.city}", with prices, timings and what makes you different. AI answers quote specific, factual text.`,
      ]
    : [`You appear for every question we tested at least once. Strengthen your service pages with prices, FAQs and specifics so you move to #1.`];
  if (weak.length) week2.push(`You show up on some engines but not others for: ${weak.slice(0, 4).map(quote).join(", ")}. Add these phrases to your page titles and FAQs.`);

  const week3 = [
    topSources.length
      ? `AI answers cite these sites most: ${topSources.join(", ")}. Create or complete your listing on each one, with the same name, address, phone and a full description.`
      : `Get listed on the main directories for ${ctx.category}s in ${ctx.city} (Google, Justdial, Practo/Zomato/etc. as relevant). AI engines pull local recommendations from them.`,
    `Ask 10 happy customers for a Google review this week. Give them a direct link and ask them to mention the service and "${ctx.city}" in their own words.`,
  ];
  if (topRivals.length)
    week3.push(`Study the competitors AI recommends instead (${topRivals.join(", ")}): which directories they're on, how many reviews they have, and what their pages say. Close the biggest gap first.`);
  if (negative)
    week3.push(`${negative} answer(s) described you negatively. Reply publicly and politely to recent complaints, and fix the recurring issue; AI summaries repeat review themes.`);

  const week4 = [
    `Get mentioned on 2-3 local sites (a ${ctx.city} news/blog article, a local "best of" list, a partner business). Third-party mentions are a strong signal for AI recommendations.`,
    `Re-run your AI visibility check. Live-search engines (Perplexity, Gemini) reflect changes within weeks; ChatGPT can take longer. Track the score monthly.`,
  ];

  return [
    { week: 1, title: "Fix the basics AI engines read first", items: week1 },
    { week: 2, title: "Answer the questions you're missing", items: week2 },
    { week: 3, title: "Get listed where AI looks, and win reviews", items: week3 },
    { week: 4, title: "Earn mentions and measure", items: week4 },
  ];
}
