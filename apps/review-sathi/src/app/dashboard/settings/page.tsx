import type { Metadata } from "next";
import { Notice } from "@/components/ui";
import { requireOrg } from "@/lib/data/session";
import { BusinessForm, GoogleActions, LocationForm } from "./forms";

export const metadata: Metadata = { title: "Settings" };

const GOOGLE_MESSAGES: Record<string, { tone: "success" | "error" | "warn"; text: string }> = {
  connected: { tone: "success", text: "Google is connected. We're fetching your reviews and drafting replies now. This takes a minute or two." },
  cancelled: { tone: "warn", text: "Google connection was cancelled." },
  invalid: { tone: "error", text: "That Google sign-in link expired. Please try again." },
  failed: { tone: "error", text: "Google sign-in failed. Please try again." },
  scope: { tone: "error", text: "Please tick the box that lets ReviewSathi manage your Business Profile, then try again." },
  no_refresh: { tone: "error", text: "Google did not grant long-term access. Remove ReviewSathi from your Google account's third-party access page and connect again." },
  no_locations: { tone: "warn", text: "This Google account doesn't manage any Business Profiles. Sign in with the account that owns your listing." },
  api_error: {
    tone: "error",
    text: "Google's Business Profile API refused the request. If this is a new setup, API access may still be waiting for Google's approval.",
  },
  forbidden: { tone: "error", text: "Only the business owner can connect Google." },
};

export default async function SettingsPage({ searchParams }: PageProps<"/dashboard/settings">) {
  const params = await searchParams;
  const ctx = await requireOrg();
  const { data: locations } = await ctx.supabase
    .from("locations")
    .select("id, title, address, enabled, reply_mode, reply_language, tone, signature, extra_instructions, last_synced_at")
    .eq("org_id", ctx.org.id)
    .order("created_at");

  const googleMessage = typeof params.google === "string" ? GOOGLE_MESSAGES[params.google] : undefined;
  const connected = Boolean(ctx.org.google_connected_at);
  const isOwner = ctx.role === "owner";

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      {params.welcome && !connected && (
        <Notice tone="success">Welcome! Your 14-day free trial has started. Connect your Google Business Profile below to get going.</Notice>
      )}
      {googleMessage && <Notice tone={googleMessage.tone}>{googleMessage.text}</Notice>}

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Google Business Profile</h2>
        {connected ? (
          <p className="text-sm text-stone-700">
            Connected as <strong>{ctx.org.google_account_email ?? "your Google account"}</strong>.
          </p>
        ) : (
          <p className="text-sm text-stone-700">
            Sign in with the Google account that manages your listing. ReviewSathi only asks for permission to read reviews, post replies and
            publish posts.
          </p>
        )}
        {isOwner && <GoogleActions connected={connected} />}
      </section>

      {locations && locations.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Locations and reply style</h2>
          {locations.map((location) => (
            <LocationForm key={location.id} location={location} disabled={!isOwner} />
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Business and alerts</h2>
        <BusinessForm org={ctx.org} disabled={!isOwner} />
      </section>
    </div>
  );
}
