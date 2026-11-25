"use server";

import { revalidatePath } from "next/cache";
import { getDrafter } from "@/lib/ai";
import { requireOrg } from "@/lib/data/session";
import { gbpClientForOrg } from "@/lib/google/connection";
import { validatePostText, validateReplyText, weekStartIST } from "@/lib/reviews/policy";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { syncOrg } from "@/lib/sync/run";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function fail(error: string): ActionResult {
  return { ok: false, error };
}

function friendlyGoogleError(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  if (message.includes("401") || message.includes("invalid_grant")) {
    return "Google access has expired. Please reconnect Google in Settings.";
  }
  if (message.includes("403")) return "Google refused this action. Check that your account still manages this profile.";
  if (message.includes("404")) return "Google could not find this review. It may have been deleted.";
  return "Could not reach Google. Please try again in a minute.";
}

async function loadReview(reviewId: string) {
  const ctx = await requireOrg();
  // RLS limits this to reviews in the caller's org.
  const { data: review } = await ctx.supabase
    .from("reviews")
    .select(
      "id, org_id, google_review_name, reviewer_name, star_rating, comment, status, locations(title, reply_language, tone, signature, extra_instructions)",
    )
    .eq("id", reviewId)
    .maybeSingle();
  return { ctx, review };
}

export async function postReply(reviewId: string, text: string): Promise<ActionResult> {
  const { ctx, review } = await loadReview(reviewId);
  if (!review) return fail("Review not found.");
  if (!ctx.access.allowed) return fail("Your trial has ended. Choose a plan in Billing to keep replying.");
  const invalid = validateReplyText(text);
  if (invalid) return fail(invalid);

  const reply = text.trim();
  const db = supabaseAdmin();
  try {
    const gbp = await gbpClientForOrg(ctx.org.id);
    await gbp.replyToReview(review.google_review_name, reply);
  } catch (err) {
    const error = friendlyGoogleError(err);
    await db.from("reviews").update({ draft_reply: reply, error }).eq("id", review.id).eq("org_id", ctx.org.id);
    revalidatePath("/dashboard");
    return fail(error);
  }
  await db
    .from("reviews")
    .update({ status: "posted", reply_text: reply, draft_reply: reply, reply_updated_at: new Date().toISOString(), error: null })
    .eq("id", review.id)
    .eq("org_id", ctx.org.id);
  revalidatePath("/dashboard");
  return { ok: true, message: "Reply posted on Google." };
}

export async function saveDraft(reviewId: string, text: string): Promise<ActionResult> {
  const ctx = await requireOrg();
  const invalid = validateReplyText(text);
  if (invalid) return fail(invalid);
  const { error } = await ctx.supabase.from("reviews").update({ draft_reply: text.trim(), status: "drafted" }).eq("id", reviewId);
  if (error) return fail("Could not save the draft.");
  revalidatePath("/dashboard");
  return { ok: true, message: "Draft saved." };
}

export async function regenerateDraft(reviewId: string): Promise<ActionResult & { draft?: string }> {
  const { ctx, review } = await loadReview(reviewId);
  if (!review) return fail("Review not found.");
  if (!ctx.access.allowed) return fail("Your trial has ended. Choose a plan in Billing to keep using AI drafts.");
  const location = review.locations as unknown as {
    title: string;
    reply_language: "auto" | "en" | "hi" | "hinglish" | "mr";
    tone: "warm" | "professional" | "friendly";
    signature: string | null;
    extra_instructions: string | null;
  } | null;
  if (!location) return fail("Location not found.");

  try {
    const draft = await getDrafter().reply({
      business: {
        name: location.title || ctx.org.name,
        businessType: ctx.org.business_type,
        city: ctx.org.city,
        signature: location.signature,
        extraInstructions: location.extra_instructions,
      },
      review: { reviewerName: review.reviewer_name, starRating: review.star_rating, comment: review.comment },
      language: location.reply_language,
      tone: location.tone,
    });
    await ctx.supabase.from("reviews").update({ draft_reply: draft, status: "drafted" }).eq("id", review.id);
    revalidatePath("/dashboard");
    return { ok: true, draft };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not write a new draft.");
  }
}

export async function setIgnored(reviewId: string, ignored: boolean): Promise<ActionResult> {
  const ctx = await requireOrg();
  const { data: review } = await ctx.supabase.from("reviews").select("draft_reply").eq("id", reviewId).maybeSingle();
  if (!review) return fail("Review not found.");
  const status = ignored ? "ignored" : review.draft_reply ? "drafted" : "new";
  const { error } = await ctx.supabase.from("reviews").update({ status }).eq("id", reviewId);
  if (error) return fail("Could not update the review.");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function syncNow(): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.access.allowed) return fail("Your trial has ended. Choose a plan in Billing to keep syncing reviews.");
  const { data: recent } = await ctx.supabase
    .from("locations")
    .select("last_synced_at")
    .eq("org_id", ctx.org.id)
    .gt("last_synced_at", new Date(Date.now() - 60_000).toISOString())
    .limit(1);
  if (recent && recent.length > 0) return { ok: true, message: "Already up to date." };
  try {
    const summary = await syncOrg(ctx.org.id);
    revalidatePath("/dashboard");
    if (summary.skipped === "not_connected") return fail("Connect Google in Settings first.");
    if (summary.errors.length && summary.inserted === 0) return fail(summary.errors[0]);
    return { ok: true, message: summary.inserted ? `${summary.inserted} new review${summary.inserted === 1 ? "" : "s"} found.` : "No new reviews." };
  } catch (err) {
    return fail(friendlyGoogleError(err));
  }
}

// ---------------------------------------------------------------------------
// Weekly posts
// ---------------------------------------------------------------------------

export async function publishPost(postId: string, text: string): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.access.allowed) return fail("Your trial has ended. Choose a plan in Billing to keep posting.");
  const invalid = validatePostText(text);
  if (invalid) return fail(invalid);
  const { data: post } = await ctx.supabase
    .from("posts")
    .select("id, status, locations(google_account_name, google_location_name)")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return fail("Post not found.");
  if (post.status === "posted") return fail("This post is already live.");
  const location = post.locations as unknown as { google_account_name: string; google_location_name: string };

  const db = supabaseAdmin();
  try {
    const gbp = await gbpClientForOrg(ctx.org.id);
    const created = await gbp.createPost(location.google_account_name, location.google_location_name, text.trim());
    await db
      .from("posts")
      .update({ status: "posted", draft_text: text.trim(), google_post_name: created.name, posted_at: new Date().toISOString(), error: null })
      .eq("id", post.id)
      .eq("org_id", ctx.org.id);
  } catch (err) {
    const error = friendlyGoogleError(err);
    await db.from("posts").update({ draft_text: text.trim(), error }).eq("id", post.id).eq("org_id", ctx.org.id);
    revalidatePath("/dashboard/posts");
    return fail(error);
  }
  revalidatePath("/dashboard/posts");
  return { ok: true, message: "Post published on Google." };
}

export async function savePost(postId: string, text: string): Promise<ActionResult> {
  const ctx = await requireOrg();
  const invalid = validatePostText(text);
  if (invalid) return fail(invalid);
  const { error } = await ctx.supabase.from("posts").update({ draft_text: text.trim() }).eq("id", postId);
  if (error) return fail("Could not save the post.");
  revalidatePath("/dashboard/posts");
  return { ok: true, message: "Saved." };
}

export async function skipPost(postId: string): Promise<ActionResult> {
  const ctx = await requireOrg();
  const { error } = await ctx.supabase.from("posts").update({ status: "skipped" }).eq("id", postId);
  if (error) return fail("Could not skip the post.");
  revalidatePath("/dashboard/posts");
  return { ok: true };
}

export async function draftPostNow(locationId: string): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.access.allowed) return fail("Your trial has ended. Choose a plan in Billing to keep using AI drafts.");
  const { data: location } = await ctx.supabase
    .from("locations")
    .select("id, title, signature, extra_instructions")
    .eq("id", locationId)
    .maybeSingle();
  if (!location) return fail("Location not found.");

  const week = weekStartIST(new Date());
  const { data: thisWeek } = await ctx.supabase
    .from("posts")
    .select("status")
    .eq("location_id", location.id)
    .eq("week_start", week)
    .maybeSingle();
  if (thisWeek?.status === "posted") return fail("You already posted this week. A new draft comes next Monday.");

  const [{ data: praise }, { data: previous }] = await Promise.all([
    ctx.supabase
      .from("reviews")
      .select("comment")
      .eq("location_id", location.id)
      .gte("star_rating", 4)
      .not("comment", "is", null)
      .order("review_created_at", { ascending: false })
      .limit(8),
    ctx.supabase.from("posts").select("draft_text").eq("location_id", location.id).order("week_start", { ascending: false }).limit(3),
  ]);

  try {
    const text = await getDrafter().post({
      business: {
        name: location.title || ctx.org.name,
        businessType: ctx.org.business_type,
        city: ctx.org.city,
        signature: location.signature,
        extraInstructions: location.extra_instructions,
      },
      today: new Date().toISOString().slice(0, 10),
      recentPraise: (praise ?? []).map((r) => r.comment as string),
      previousPosts: (previous ?? []).map((p) => p.draft_text as string),
    });
    const { error } = await supabaseAdmin()
      .from("posts")
      .upsert(
        { org_id: ctx.org.id, location_id: location.id, week_start: week, draft_text: text, status: "draft", error: null },
        { onConflict: "location_id,week_start" },
      );
    if (error) throw error;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not draft a post.");
  }
  revalidatePath("/dashboard/posts");
  return { ok: true, message: "New draft ready." };
}
