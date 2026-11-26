import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { syncAllOrgs } from "@/lib/sync/run";

export const maxDuration = 300;

/** Hourly: fetch new reviews, draft replies, auto-post where allowed, send alerts. */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const results = await syncAllOrgs();
  return NextResponse.json({
    orgs: results.length,
    inserted: results.reduce((n, r) => n + r.inserted, 0),
    autoPosted: results.reduce((n, r) => n + r.autoPosted, 0),
    errors: results.flatMap((r) => r.errors.map((e) => `${r.orgId}: ${e}`)).slice(0, 50),
  });
}
