import "server-only";
import { env } from "@/lib/env";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DemoGbpClient, HttpGbpClient, type GbpClient } from "./gbp";
import { refreshAccessToken } from "./oauth";

type ConnectionRow = {
  org_id: string;
  encrypted_refresh_token: string;
  access_token_cache: string | null;
  access_token_expires_at: string | null;
  is_demo: boolean;
};

export class NotConnectedError extends Error {
  constructor() {
    super("Google Business Profile is not connected for this business");
    this.name = "NotConnectedError";
  }
}

/** Builds a Google client for an org, refreshing and caching the access token. */
export async function gbpClientForOrg(orgId: string): Promise<GbpClient> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("google_connections")
    .select("org_id, encrypted_refresh_token, access_token_cache, access_token_expires_at, is_demo")
    .eq("org_id", orgId)
    .maybeSingle<ConnectionRow>();
  if (error) throw error;
  if (!data) throw new NotConnectedError();
  if (data.is_demo) return new DemoGbpClient();

  const key = env.tokenEncryptionKey();
  let cached: { token: string; expiresAt: number } | null =
    data.access_token_cache && data.access_token_expires_at
      ? { token: decryptSecret(data.access_token_cache, key), expiresAt: Date.parse(data.access_token_expires_at) }
      : null;

  const getAccessToken = async () => {
    if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;
    const refreshed = await refreshAccessToken({
      refreshToken: decryptSecret(data.encrypted_refresh_token, key),
      clientId: env.googleClientId(),
      clientSecret: env.googleClientSecret(),
    });
    const expiresAt = Date.now() + refreshed.expires_in * 1000;
    cached = { token: refreshed.access_token, expiresAt };
    await db
      .from("google_connections")
      .update({
        access_token_cache: encryptSecret(refreshed.access_token, key),
        access_token_expires_at: new Date(expiresAt).toISOString(),
      })
      .eq("org_id", orgId);
    return refreshed.access_token;
  };

  return new HttpGbpClient(getAccessToken);
}
