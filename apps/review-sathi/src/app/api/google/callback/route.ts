import { NextResponse, after, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { encryptSecret, verifyState } from "@/lib/crypto";
import { requireOrg } from "@/lib/data/session";
import { gbpClientForOrg } from "@/lib/google/connection";
import { importLocations } from "@/lib/google/import";
import { exchangeCode, fetchGoogleEmail, GBP_SCOPE } from "@/lib/google/oauth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { syncOrg } from "@/lib/sync/run";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const appUrl = env.appUrl();
  const back = (status: string) => NextResponse.redirect(`${appUrl}/dashboard/settings?google=${status}`);
  const params = request.nextUrl.searchParams;

  if (params.get("error")) return back("cancelled");
  const code = params.get("code");
  const state = verifyState<{ org: string; user: string }>(params.get("state") ?? "", env.tokenEncryptionKey());
  if (!code || !state) return back("invalid");

  // The user finishing the flow must be the one who started it.
  const ctx = await requireOrg();
  if (ctx.org.id !== state.org || ctx.userId !== state.user) return back("invalid");

  let tokens;
  try {
    tokens = await exchangeCode({
      code,
      clientId: env.googleClientId(),
      clientSecret: env.googleClientSecret(),
      redirectUri: `${appUrl}/api/google/callback`,
    });
  } catch (err) {
    console.error("[google callback] token exchange failed", err);
    return back("failed");
  }
  if (!tokens.scope?.includes(GBP_SCOPE)) return back("scope");
  if (!tokens.refresh_token) return back("no_refresh");

  const key = env.tokenEncryptionKey();
  const db = supabaseAdmin();
  const email = await fetchGoogleEmail(tokens.access_token);
  const { error } = await db.from("google_connections").upsert({
    org_id: ctx.org.id,
    encrypted_refresh_token: encryptSecret(tokens.refresh_token, key),
    access_token_cache: encryptSecret(tokens.access_token, key),
    access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    is_demo: false,
  });
  if (error) return back("failed");
  await db.from("orgs").update({ google_account_email: email, google_connected_at: new Date().toISOString() }).eq("id", ctx.org.id);

  try {
    const found = await importLocations(ctx.org.id, await gbpClientForOrg(ctx.org.id));
    if (found === 0) return back("no_locations");
  } catch (err) {
    console.error("[google callback] location import failed", err);
    return back("api_error");
  }

  after(() => syncOrg(ctx.org.id, { notify: false }).catch((err) => console.error("[initial sync]", err)));
  return back("connected");
}
