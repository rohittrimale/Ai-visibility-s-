import { createMemoryStore } from "./memory";
import { createSupabaseStore } from "./supabase";
import type { Store } from "./types";

const g = globalThis as unknown as { __store?: Store };

/** Supabase when configured; otherwise an in-memory store (blocked in production). */
export function getStore(): Store {
  if (g.__store) return g.__store;
  const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (configured) g.__store = createSupabaseStore();
  else if (process.env.NODE_ENV === "production") throw new Error("Supabase is not configured");
  else g.__store = createMemoryStore();
  return g.__store;
}

export type { Store } from "./types";
