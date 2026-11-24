import { createHash } from "node:crypto";
import { config } from "./config";
import type { Store } from "./store/types";

export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);

/** Salted hash so raw IPs / emails are never stored in rate-limit or check tables. */
export const hashValue = (kind: "ip" | "email", value: string) =>
  createHash("sha256").update(`${config.hashSalt}:${kind}:${value.trim().toLowerCase()}`).digest("hex").slice(0, 32);

export function clientIp(headers: Headers): string {
  // On Vercel the platform sets x-forwarded-for; the left-most entry is the client.
  const xff = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || headers.get("x-real-ip") || "unknown";
}

export const allowIp = (store: Store, ip: string) => store.hitRateLimit(`ip:${hashValue("ip", ip)}`, config.ipLimit);
export const allowEmail = (store: Store, email: string) => store.hitRateLimit(`email:${hashValue("email", email)}`, config.emailLimit);

/** Reserve the estimated cost against the monthly cap. False = cap reached; stop free checks. */
export const reserveBudget = (store: Store) =>
  store.reserveSpend(monthKey(), config.estCostPerCheckUsd, config.monthlyCapUsd);

/** Replace the reservation with the real cost. */
export const settleBudget = (store: Store, actualUsd: number) =>
  store.addSpend(monthKey(), actualUsd - config.estCostPerCheckUsd);
