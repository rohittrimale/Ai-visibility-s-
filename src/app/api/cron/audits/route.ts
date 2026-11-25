import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runAudit } from "@/lib/audit";
import { enabledProviders } from "@/lib/providers";
import { getStore } from "@/lib/store";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const authorized = (req: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(req.headers.get("authorization") ?? ""), b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Safety net for paid Deep Audits: runs any audit that was paid but never finished
 * (e.g. the webhook's background run was cut off). One audit per invocation fits the time budget.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const store = getStore();
  const [next] = await store.listAuditsToRun();
  if (!next) return NextResponse.json({ ran: 0 });
  const result = await runAudit(store, next, enabledProviders());
  return NextResponse.json({ ran: 1, id: next.id, result });
}
