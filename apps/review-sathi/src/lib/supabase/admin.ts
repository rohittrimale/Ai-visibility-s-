import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let admin: SupabaseClient | null = null;

/**
 * Service-role client. Bypasses row level security, so only use it in
 * server code after you have checked who the caller is.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!admin) {
    admin = createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
