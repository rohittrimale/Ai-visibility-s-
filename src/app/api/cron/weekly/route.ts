import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { PLANS } from "@/lib/billing/plans";
import { config } from "@/lib/config";
import { generatePrompts } from "@/lib/prompts";
import { enabledProviders } from "@/lib/providers";
import { runCheck } from "@/lib/runner";
import { getStore } from "@/lib/store";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const authorized = (req: Request) => {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  if (!secret) return false; // refuse to run unauthenticated
  const a = Buffer.from(got), b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Weekly re-run for paid, tracked businesses. Triggered by Vercel Cron (vercel.json) or
 * any scheduler (Supabase pg_cron + pg_net) sending `Authorization: Bearer $CRON_SECRET`.
 * Processes sequentially within the time budget; leftovers are picked up on the next invocation
 * because businesses checked in the last 6 days are skipped.
 */
export async function GET(req: Request) {
  if (!config.paidEnabled) return NextResponse.json({ skipped: "paid features disabled" });
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store = getStore();
  const providers = enabledProviders();
  if (!providers.length) return NextResponse.json({ error: "No engines enabled" }, { status: 503 });

  const started = Date.now();
  const sixDays = 6 * 86400_000;
  let ran = 0, skipped = 0, deferred = 0;

  for (const biz of await store.listTrackedBusinesses()) {
    const last = await store.latestCheckDate(biz.id);
    if (last && Date.now() - new Date(last).getTime() < sixDays) { skipped++; continue; }
    if (Date.now() - started > 240_000) { deferred++; continue; }
    const limit = PLANS[biz.plan].maxPrompts;
    const prompts = (biz.prompts.length ? biz.prompts : generatePrompts(biz, limit)).slice(0, limit);
    const check = await store.createCheck({ business_id: biz.id, source: "weekly", ip_hash: null });
    await runCheck({ store, checkId: check.id, business: biz, prompts, providers, deadlineMs: 60_000 });
    ran++;
  }
  return NextResponse.json({ ran, skipped, deferred });
}
