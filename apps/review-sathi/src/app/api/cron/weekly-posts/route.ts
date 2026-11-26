import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { draftWeeklyPosts } from "@/lib/sync/run";

export const maxDuration = 300;

/** Mondays: draft this week's Google post for each location and email the owner. */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await draftWeeklyPosts());
}
