import { NextResponse, after } from "next/server";
import { env } from "@/lib/env";
import { encryptSecret, signState } from "@/lib/crypto";
import { requireOrg } from "@/lib/data/session";
import { DEMO_ACCOUNT, DemoGbpClient } from "@/lib/google/gbp";
import { importLocations } from "@/lib/google/import";
import { buildGoogleAuthUrl } from "@/lib/google/oauth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { syncOrg } from "@/lib/sync/run";

export const maxDuration = 300;

/** Starts the Google connection. In demo mode, connects a sample profile instead. */
export async function GET() {
  const ctx = await requireOrg();
  const appUrl = env.appUrl();
  if (ctx.role !== "owner") return NextResponse.redirect(`${appUrl}/dashboard/settings?google=forbidden`);

  if (env.googleDemoMode()) {
    const db = supabaseAdmin();
    await db.from("google_connections").upsert({
      org_id: ctx.org.id,
      google_account_name: DEMO_ACCOUNT,
      encrypted_refresh_token: encryptSecret("demo", env.tokenEncryptionKey()),
      is_demo: true,
    });
    await db
      .from("orgs")
      .update({ google_account_email: "demo@reviewsathi.app", google_connected_at: new Date().toISOString() })
      .eq("id", ctx.org.id);
    await importLocations(ctx.org.id, new DemoGbpClient());
    after(() => syncOrg(ctx.org.id, { notify: false }).catch((err) => console.error("[demo sync]", err)));
    return NextResponse.redirect(`${appUrl}/dashboard/settings?google=connected`);
  }

  const state = signState({ org: ctx.org.id, user: ctx.userId, exp: Date.now() + 10 * 60_000 }, env.tokenEncryptionKey());
  return NextResponse.redirect(
    buildGoogleAuthUrl({ clientId: env.googleClientId(), redirectUri: `${appUrl}/api/google/callback`, state }),
  );
}
