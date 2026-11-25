import { nicheForCategory } from "./niches";

type Ctx = { category: string; city: string };

/**
 * Realistic customer questions. The first 8 are the free-check set, ordered by
 * how commonly people phrase them; more are appended for paid plans.
 */
export function generatePrompts({ category, city }: Ctx, count = 8): string[] {
  const niche = nicheForCategory(category);
  const cat = category.toLowerCase();
  const syn = niche?.synonym ?? cat;
  const services = niche?.services ?? ["services", "pricing", "reviews"];

  const base = [
    `best ${cat} in ${city}`,
    `top rated ${syn} in ${city}`,
    `affordable ${cat} near ${city}`,
    `which ${cat} should I go to in ${city}?`,
    `most trusted ${cat} in ${city} with good reviews`,
    `recommend a good ${syn} in ${city}`,
    `${cat} near me in ${city} open on weekends`,
    `best ${cat} in ${city} for ${services[0]}`,
  ];
  const extra = [
    ...services.slice(1).map((s) => `best ${cat} in ${city} for ${s}`),
    `cheap ${cat} in ${city}`,
    `premium ${cat} in ${city}`,
    `${cat} in ${city} with best customer service`,
    `top 5 ${syn}s in ${city}`,
    `who is the best ${cat} in ${city} according to reviews?`,
    `${syn} in ${city} for first-time customers`,
    `new ${cat} in ${city} worth trying`,
    `${cat} in ${city} recommended by locals`,
    ...services.map((s) => `${s} in ${city} — which ${cat} is best?`),
    ...services.map((s) => `affordable ${s} in ${city}`),
    `${cat} in ${city} with transparent pricing`,
    `family friendly ${cat} in ${city}`,
    `${cat} in ${city} that accepts walk-ins`,
    `highly recommended ${syn} in ${city} for families`,
    `best value ${cat} in ${city}`,
    `${syn} in ${city} with experienced staff`,
    `where should I go for a ${cat} in ${city}?`,
    `${cat} in ${city} with online booking`,
    `list the best ${syn}s in ${city} and why`,
    `${cat} in ${city} with the most positive Google reviews`,
    `luxury ${syn} in ${city}`,
    `budget ${syn} in ${city} for students`,
  ];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of [...base, ...extra]) {
    if (!seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return out.slice(0, Math.max(1, count));
}
