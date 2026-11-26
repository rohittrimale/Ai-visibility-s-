import "server-only";
import { getDrafter } from "@/lib/ai";
import { accessState, maxLocationsFor } from "@/lib/billing/plans";
import { sendEmail } from "@/lib/email/send";
import { negativeReviewAlert, newReviewsDigest, trialEndingSoon, weeklyPostReady } from "@/lib/email/templates";
import { env } from "@/lib/env";
import { gbpClientForOrg, NotConnectedError } from "@/lib/google/connection";
import { weekStartIST } from "@/lib/reviews/policy";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { syncLocation, type SyncLocation, type SyncOrg, type SyncStore } from "./sync-location";

type OrgRow = SyncOrg & {
  plan: string;
  trial_ends_at: string;
  alert_email: string | null;
  weekly_digest: boolean;
  subscriptions: { status: string; current_period_end: string | null } | null;
};

const ORG_SELECT =
  "id, name, business_type, city, negative_threshold, plan, trial_ends_at, alert_email, weekly_digest, subscriptions(status, current_period_end)";

const LOCATION_SELECT =
  "id, org_id, title, google_account_name, google_location_name, reply_mode, reply_language, tone, signature, extra_instructions, last_synced_at";

function supabaseStore(): SyncStore {
  const db = supabaseAdmin();
  return {
    async listReviews(locationId) {
      const { data, error } = await db
        .from("reviews")
        .select("id, google_review_name, status, star_rating, comment, reviewer_name, draft_reply, reply_text, review_updated_at, error")
        .eq("location_id", locationId);
      if (error) throw error;
      return data ?? [];
    },
    async insertReview(row) {
      const { error } = await db.from("reviews").upsert(row, { onConflict: "location_id,google_review_name", ignoreDuplicates: true });
      if (error) throw error;
    },
    async updateReview(id, patch) {
      const { error } = await db.from("reviews").update(patch).eq("id", id);
      if (error) throw error;
    },
  };
}

function normalizeSub(sub: unknown): { status: string; current_period_end: string | null } | null {
  if (!sub) return null;
  return (Array.isArray(sub) ? sub[0] : sub) ?? null;
}

async function ownerEmail(org: OrgRow): Promise<string | null> {
  if (org.alert_email) return org.alert_email;
  const db = supabaseAdmin();
  const { data: member } = await db
    .from("org_members")
    .select("user_id")
    .eq("org_id", org.id)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle<{ user_id: string }>();
  if (!member) return null;
  const { data } = await db.auth.admin.getUserById(member.user_id);
  return data.user?.email ?? null;
}

export type OrgSyncSummary = { orgId: string; skipped?: string; inserted: number; drafted: number; autoPosted: number; errors: string[] };

export async function syncOrg(orgId: string, opts: { notify?: boolean } = {}): Promise<OrgSyncSummary> {
  const db = supabaseAdmin();
  const { data: orgRaw, error } = await db.from("orgs").select(ORG_SELECT).eq("id", orgId).single();
  if (error) throw error;
  const org = { ...(orgRaw as unknown as OrgRow), subscriptions: normalizeSub((orgRaw as { subscriptions: unknown }).subscriptions) };
  const summary: OrgSyncSummary = { orgId, inserted: 0, drafted: 0, autoPosted: 0, errors: [] };

  const access = accessState({
    trialEndsAt: org.trial_ends_at,
    subscription: org.subscriptions ? { status: org.subscriptions.status, currentPeriodEnd: org.subscriptions.current_period_end } : null,
  });
  if (!access.allowed) return { ...summary, skipped: access.reason };

  let gbp;
  try {
    gbp = await gbpClientForOrg(orgId);
  } catch (err) {
    if (err instanceof NotConnectedError) return { ...summary, skipped: "not_connected" };
    throw err;
  }

  const limit = maxLocationsFor(org.plan, access.reason === "trial");
  const { data: locations, error: locErr } = await db
    .from("locations")
    .select(LOCATION_SELECT)
    .eq("org_id", orgId)
    .eq("enabled", true)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (locErr) throw locErr;

  const store = supabaseStore();
  const drafter = getDrafter();
  const alerts = [];
  for (const location of (locations ?? []) as SyncLocation[]) {
    try {
      const result = await syncLocation({ org, location, gbp, drafter, store });
      summary.inserted += result.inserted;
      summary.drafted += result.drafted;
      summary.autoPosted += result.autoPosted;
      summary.errors.push(...result.errors);
      alerts.push(...result.alerts);
      await db.from("locations").update({ last_synced_at: new Date().toISOString() }).eq("id", location.id);
    } catch (err) {
      summary.errors.push(`${location.title}: ${err instanceof Error ? err.message : "sync failed"}`);
    }
  }

  if (opts.notify !== false && (alerts.length > 0 || summary.inserted > 0)) {
    const to = await ownerEmail(org);
    if (to) {
      const dashboardUrl = `${env.appUrl()}/dashboard`;
      for (const alert of alerts.slice(0, 5)) {
        await sendEmail(to, negativeReviewAlert(alert, dashboardUrl));
      }
      const { count } = await db
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "drafted");
      const nonAlerted = summary.inserted - alerts.length;
      if (nonAlerted > 0 && (count ?? 0) > 0) {
        await sendEmail(to, newReviewsDigest({ businessName: org.name, count: nonAlerted, pending: count ?? 0, dashboardUrl }));
      }
    }
  }

  return summary;
}

/** Orgs that might need syncing: in trial or with a subscription that can still be active, and connected to Google. */
export async function syncableOrgIds(): Promise<string[]> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("google_connections").select("org_id");
  if (error) throw error;
  return (data ?? []).map((row: { org_id: string }) => row.org_id);
}

export async function syncAllOrgs(): Promise<OrgSyncSummary[]> {
  const results: OrgSyncSummary[] = [];
  for (const orgId of await syncableOrgIds()) {
    try {
      results.push(await syncOrg(orgId));
    } catch (err) {
      results.push({ orgId, inserted: 0, drafted: 0, autoPosted: 0, errors: [err instanceof Error ? err.message : "failed"] });
    }
  }
  return results;
}

/** Drafts this week's post for every enabled location and emails the owner. Safe to run more than once a week. */
export async function draftWeeklyPosts(now = new Date()): Promise<{ drafted: number; errors: string[] }> {
  const db = supabaseAdmin();
  const week = weekStartIST(now);
  const drafter = getDrafter();
  let drafted = 0;
  const errors: string[] = [];

  for (const orgId of await syncableOrgIds()) {
    const { data: orgRaw } = await db.from("orgs").select(ORG_SELECT).eq("id", orgId).single();
    if (!orgRaw) continue;
    const org = { ...(orgRaw as unknown as OrgRow), subscriptions: normalizeSub((orgRaw as { subscriptions: unknown }).subscriptions) };
    const access = accessState({
      trialEndsAt: org.trial_ends_at,
      subscription: org.subscriptions ? { status: org.subscriptions.status, currentPeriodEnd: org.subscriptions.current_period_end } : null,
      now,
    });
    if (!access.allowed) continue;

    const { data: locations } = await db
      .from("locations")
      .select(LOCATION_SELECT)
      .eq("org_id", orgId)
      .eq("enabled", true)
      .order("created_at", { ascending: true })
      .limit(maxLocationsFor(org.plan, access.reason === "trial"));

    for (const location of (locations ?? []) as SyncLocation[]) {
      const { data: existing } = await db.from("posts").select("id").eq("location_id", location.id).eq("week_start", week).maybeSingle();
      if (existing) continue;

      const [{ data: praise }, { data: previous }] = await Promise.all([
        db
          .from("reviews")
          .select("comment")
          .eq("location_id", location.id)
          .gte("star_rating", 4)
          .not("comment", "is", null)
          .order("review_created_at", { ascending: false })
          .limit(8),
        db.from("posts").select("draft_text").eq("location_id", location.id).order("week_start", { ascending: false }).limit(3),
      ]);

      try {
        const text = await drafter.post({
          business: {
            name: location.title || org.name,
            businessType: org.business_type,
            city: org.city,
            signature: location.signature,
            extraInstructions: location.extra_instructions,
          },
          today: now.toISOString().slice(0, 10),
          recentPraise: (praise ?? []).map((r: { comment: string }) => r.comment),
          previousPosts: (previous ?? []).map((p: { draft_text: string }) => p.draft_text),
        });
        const { error } = await db
          .from("posts")
          .upsert(
            { org_id: orgId, location_id: location.id, week_start: week, draft_text: text, status: "draft" },
            { onConflict: "location_id,week_start", ignoreDuplicates: true },
          );
        if (error) throw error;
        drafted += 1;
        const to = await ownerEmail(org);
        if (to && org.weekly_digest) {
          await sendEmail(to, weeklyPostReady({ businessName: location.title, draft: text, postsUrl: `${env.appUrl()}/dashboard/posts` }));
        }
      } catch (err) {
        errors.push(`${location.title}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
  }
  return { drafted, errors };
}

/** Emails owners whose trial ends in 3 days or 1 day. Runs daily. */
export async function sendTrialReminders(now = new Date()): Promise<number> {
  const db = supabaseAdmin();
  let sent = 0;
  for (const days of [3, 1]) {
    const start = new Date(now.getTime() + (days - 1) * 86_400_000).toISOString();
    const end = new Date(now.getTime() + days * 86_400_000).toISOString();
    const { data } = await db.from("orgs").select(ORG_SELECT).gt("trial_ends_at", start).lte("trial_ends_at", end);
    for (const raw of data ?? []) {
      const org = { ...(raw as unknown as OrgRow), subscriptions: normalizeSub((raw as { subscriptions: unknown }).subscriptions) };
      const status = org.subscriptions?.status;
      if (status === "active" || status === "authenticated") continue;
      const to = await ownerEmail(org);
      if (to && (await sendEmail(to, trialEndingSoon({ businessName: org.name, daysLeft: days, billingUrl: `${env.appUrl()}/dashboard/billing` })))) {
        sent += 1;
      }
    }
  }
  return sent;
}
