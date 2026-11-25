import "server-only";
import type { NextRequest } from "next/server";
import { safeEqual } from "@/lib/crypto";

/** Vercel Cron (and the GitHub Actions fallback) send `Authorization: Bearer $CRON_SECRET`. */
export function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron] CRON_SECRET is not set; refusing to run");
    return false;
  }
  return safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`);
}
