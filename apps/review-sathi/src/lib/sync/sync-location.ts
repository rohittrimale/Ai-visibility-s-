import type { Drafter } from "@/lib/ai/generate";
import type { BusinessContext, ReplyLanguage, Tone } from "@/lib/ai/prompts";
import type { GbpClient } from "@/lib/google/gbp";
import type { GbpReview } from "@/lib/google/types";
import { decideForNewReview, type ReplyMode } from "@/lib/reviews/policy";
import type { AlertReview } from "@/lib/email/templates";

export type StoredReview = {
  id: string;
  google_review_name: string;
  status: string;
  star_rating: number;
  comment: string | null;
  reviewer_name: string | null;
  draft_reply: string | null;
  reply_text: string | null;
  review_updated_at: string | null;
  error: string | null;
};

export type NewReviewRow = {
  org_id: string;
  location_id: string;
  google_review_name: string;
  reviewer_name: string | null;
  star_rating: number;
  comment: string | null;
  review_created_at: string;
  review_updated_at: string | null;
  reply_text: string | null;
  reply_updated_at: string | null;
  draft_reply: string | null;
  status: string;
  error: string | null;
  alerted_at: string | null;
};

/** Persistence used by the sync. Supabase in production, in-memory in tests. */
export interface SyncStore {
  listReviews(locationId: string): Promise<StoredReview[]>;
  insertReview(row: NewReviewRow): Promise<void>;
  updateReview(id: string, patch: Partial<NewReviewRow>): Promise<void>;
}

export type SyncLocation = {
  id: string;
  org_id: string;
  title: string;
  google_account_name: string;
  google_location_name: string;
  reply_mode: ReplyMode;
  reply_language: ReplyLanguage;
  tone: Tone;
  signature: string | null;
  extra_instructions: string | null;
  last_synced_at: string | null;
};

export type SyncOrg = {
  id: string;
  name: string;
  business_type: string;
  city: string | null;
  negative_threshold: number;
};

export type SyncResult = {
  fetched: number;
  inserted: number;
  drafted: number;
  autoPosted: number;
  alerts: AlertReview[];
  errors: string[];
};

/** AI drafts per location per run, so a first sync with a long backlog stays cheap and fast. */
export const MAX_DRAFTS_PER_RUN = 25;
/** On the first sync, only draft replies for reviews newer than this. Older ones stay visible but undrafted. */
export const BACKLOG_DAYS = 90;
/** Reviews older than this never trigger an alert email. */
const ALERT_WINDOW_MS = 2 * 86_400_000;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message.slice(0, 500) : "Unknown error";
}

export async function syncLocation(opts: {
  org: SyncOrg;
  location: SyncLocation;
  gbp: GbpClient;
  drafter: Drafter;
  store: SyncStore;
  now?: Date;
}): Promise<SyncResult> {
  const { org, location, gbp, drafter, store } = opts;
  const now = opts.now ?? new Date();
  const result: SyncResult = { fetched: 0, inserted: 0, drafted: 0, autoPosted: 0, alerts: [], errors: [] };

  const business: BusinessContext = {
    name: location.title || org.name,
    businessType: org.business_type,
    city: org.city,
    signature: location.signature,
    extraInstructions: location.extra_instructions,
  };

  const remote = await gbp.listReviews(location.google_account_name, location.google_location_name);
  result.fetched = remote.length;
  const existing = new Map((await store.listReviews(location.id)).map((r) => [r.google_review_name, r]));

  let draftBudget = MAX_DRAFTS_PER_RUN;
  const backlogCutoff = now.getTime() - BACKLOG_DAYS * 86_400_000;
  const alertCutoff = Math.max(
    now.getTime() - ALERT_WINDOW_MS,
    location.last_synced_at ? Date.parse(location.last_synced_at) - 3_600_000 : 0,
  );

  const draftFor = (review: Pick<GbpReview, "reviewerName" | "starRating" | "comment">) =>
    drafter.reply({
      business,
      review: { reviewerName: review.reviewerName, starRating: review.starRating, comment: review.comment },
      language: location.reply_language,
      tone: location.tone,
    });

  // Newest first, so the draft budget goes to the reviews that matter most.
  const ordered = [...remote].sort((a, b) => Date.parse(b.createTime) - Date.parse(a.createTime));

  for (const review of ordered) {
    const stored = existing.get(review.name);

    if (stored) {
      // Someone replied directly on Google (or our reply changed there): mirror it.
      if (review.reply && review.reply.comment !== stored.reply_text) {
        await store.updateReview(stored.id, {
          reply_text: review.reply.comment,
          reply_updated_at: review.reply.updateTime,
          status: stored.status === "posted" ? "posted" : "replied_elsewhere",
          draft_reply: stored.status === "posted" ? stored.draft_reply : null,
          error: null,
        });
        continue;
      }
      // The customer edited an unanswered review: refresh it and draft again.
      const edited =
        !review.reply &&
        review.updateTime &&
        stored.review_updated_at &&
        Date.parse(review.updateTime) > Date.parse(stored.review_updated_at) &&
        (review.comment !== stored.comment || review.starRating !== stored.star_rating);
      if (edited && (stored.status === "new" || stored.status === "drafted" || stored.status === "failed")) {
        let draft: string | null = null;
        let error: string | null = null;
        if (draftBudget > 0) {
          draftBudget -= 1;
          try {
            draft = await draftFor(review);
            result.drafted += 1;
          } catch (err) {
            error = errorMessage(err);
            result.errors.push(error);
          }
        }
        await store.updateReview(stored.id, {
          star_rating: review.starRating,
          comment: review.comment,
          review_updated_at: review.updateTime,
          draft_reply: draft,
          status: draft ? "drafted" : "new",
          error,
        });
        continue;
      }
      // Earlier runs ran out of budget or hit an error: draft it now.
      if (stored.status === "new" && !stored.draft_reply && draftBudget > 0) {
        draftBudget -= 1;
        try {
          const draft = await draftFor(review);
          result.drafted += 1;
          await store.updateReview(stored.id, { draft_reply: draft, status: "drafted", error: null });
        } catch (err) {
          const message = errorMessage(err);
          result.errors.push(message);
          await store.updateReview(stored.id, { error: message });
        }
      }
      continue;
    }

    // A review we have never seen.
    const decision = decideForNewReview({
      starRating: review.starRating,
      hasExistingReply: Boolean(review.reply),
      replyMode: location.reply_mode,
      negativeThreshold: org.negative_threshold,
    });
    const createdAt = Date.parse(review.createTime);
    const isBacklog = !location.last_synced_at && createdAt < backlogCutoff;

    const row: NewReviewRow = {
      org_id: org.id,
      location_id: location.id,
      google_review_name: review.name,
      reviewer_name: review.reviewerName,
      star_rating: review.starRating,
      comment: review.comment,
      review_created_at: review.createTime,
      review_updated_at: review.updateTime,
      reply_text: review.reply?.comment ?? null,
      reply_updated_at: review.reply?.updateTime ?? null,
      draft_reply: null,
      status: decision.status,
      error: null,
      alerted_at: null,
    };

    if (decision.draft && !isBacklog && draftBudget > 0) {
      draftBudget -= 1;
      try {
        row.draft_reply = await draftFor(review);
        row.status = "drafted";
        result.drafted += 1;
      } catch (err) {
        row.error = errorMessage(err);
        result.errors.push(row.error);
      }
    }

    // Auto-post only fresh reviews, never the first-sync backlog: the owner should see the tone first.
    const fresh = Boolean(location.last_synced_at) && createdAt >= Date.parse(location.last_synced_at!) - 86_400_000;
    if (decision.autoPost && fresh && row.draft_reply) {
      try {
        await gbp.replyToReview(review.name, row.draft_reply);
        row.status = "posted";
        row.reply_text = row.draft_reply;
        row.reply_updated_at = now.toISOString();
        result.autoPosted += 1;
      } catch (err) {
        row.error = `Auto-post failed: ${errorMessage(err)}`;
        result.errors.push(row.error);
      }
    }

    if (decision.alert && createdAt >= alertCutoff) {
      row.alerted_at = now.toISOString();
      result.alerts.push({
        locationTitle: location.title,
        reviewerName: review.reviewerName,
        starRating: review.starRating,
        comment: review.comment,
        draftReply: row.draft_reply,
      });
    }

    await store.insertReview(row);
    result.inserted += 1;
  }

  return result;
}
