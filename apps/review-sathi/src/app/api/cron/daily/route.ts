import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { sendTrialReminders } from "@/lib/sync/run";

/** Daily: trial-ending reminders. */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ trialReminders: await sendTrialReminders() });
}
