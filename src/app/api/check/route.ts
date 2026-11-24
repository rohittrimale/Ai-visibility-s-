import { NextResponse } from "next/server";
import { config, PROMPTS_PER_FREE_CHECK } from "@/lib/config";
import { allowIp, clientIp, hashValue, reserveBudget, settleBudget } from "@/lib/limits";
import { generatePrompts } from "@/lib/prompts";
import { enabledProviders } from "@/lib/providers";
import { runCheck } from "@/lib/runner";
import { getStore } from "@/lib/store";
import { checkInputSchema } from "@/lib/validation";

export const maxDuration = 60; // 8 prompts x 3 engines + parsing
export const dynamic = "force-dynamic";

const err = (status: number, code: string, message: string, extra: object = {}) =>
  NextResponse.json({ error: message, code, ...extra }, { status });

export async function POST(req: Request) {
  // Cheap guard before parsing: a legit payload is well under 2 KB.
  const raw = await req.text();
  if (raw.length > 4000) return err(413, "too_large", "Request too large.");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return err(400, "bad_json", "Invalid request.");
  }

  const parsed = checkInputSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0] ?? "form")] ??= i.message;
    return err(400, "invalid", "Please check the highlighted fields.", { fields });
  }
  const input = parsed.data;

  const providers = enabledProviders();
  if (!providers.length) return err(503, "no_engines", "The checker is temporarily unavailable.");

  const store = getStore();
  const ip = clientIp(req.headers);

  // 1) per-IP daily limit
  if (!(await allowIp(store, ip)))
    return err(429, "rate_limited", `You've used your ${config.ipLimit} free checks for today. Come back tomorrow.`);

  // 2) monthly spend cap (reserve the estimated cost atomically)
  if (!(await reserveBudget(store)))
    return err(503, "budget", "Free checks are paused for now because we've hit this month's capacity. Please try again next month.");

  let costUsd = 0;
  try {
    const business = await store.createBusiness({
      name: input.businessName,
      website: input.website,
      city: input.city,
      category: input.category,
      competitors: input.competitors,
    });
    const check = await store.createCheck({ business_id: business.id, source: "free", ip_hash: hashValue("ip", ip) });
    const out = await runCheck({
      store,
      checkId: check.id,
      business,
      prompts: generatePrompts(business, PROMPTS_PER_FREE_CHECK),
      providers,
    });
    costUsd = out.costUsd;
    if (!out.ok) return err(502, "engines_failed", "The AI engines didn't respond. Please try again in a few minutes.");
    return NextResponse.json({ id: check.id });
  } catch (e) {
    console.error("check failed", e instanceof Error ? e.message : e);
    return err(500, "server", "Something went wrong. Please try again.");
  } finally {
    await settleBudget(store, costUsd).catch(() => {});
  }
}
