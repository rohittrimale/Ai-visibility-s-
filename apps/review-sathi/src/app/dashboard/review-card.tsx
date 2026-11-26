"use client";

import { useState, useTransition } from "react";
import { Stars, timeAgo } from "@/components/ui";
import { MAX_REPLY_CHARS } from "@/lib/reviews/policy";
import { postReply, regenerateDraft, saveDraft, setIgnored } from "./actions";

export type ReviewItem = {
  id: string;
  reviewerName: string | null;
  starRating: number;
  comment: string | null;
  createdAt: string;
  replyText: string | null;
  draftReply: string | null;
  status: string;
  error: string | null;
  locationTitle: string;
};

export function ReviewCard({ review, canAct }: { review: ReviewItem; canAct: boolean }) {
  const [text, setText] = useState(review.draftReply ?? "");
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(review.error ? { ok: false, text: review.error } : null);

  const replied = review.status === "posted" || review.status === "replied_elsewhere";
  const ignored = review.status === "ignored";
  const low = review.starRating <= 3;

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string; draft?: string }>) {
    setFeedback(null);
    start(async () => {
      const result = await fn();
      if (result.draft) setText(result.draft);
      if (result.ok) {
        if (result.message) setFeedback({ ok: true, text: result.message });
      } else {
        setFeedback({ ok: false, text: result.error ?? "Something went wrong." });
      }
    });
  }

  return (
    <article className={`card ${low && !replied && !ignored ? "border-l-4 border-l-red-500" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{review.reviewerName ?? "A Google user"}</span>
          <Stars rating={review.starRating} size="text-sm" />
        </div>
        <span className="text-xs text-stone-500" suppressHydrationWarning>
          {review.locationTitle} · {timeAgo(review.createdAt)}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-stone-800">{review.comment ?? <em className="text-stone-500">Rating only, no text.</em>}</p>

      {replied ? (
        <div className="mt-4 rounded-lg bg-stone-50 p-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-500">
            {review.status === "posted" ? "Your reply (live on Google)" : "Replied on Google"}
          </p>
          <p className="whitespace-pre-wrap text-sm text-stone-800">{review.replyText}</p>
        </div>
      ) : ignored ? (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-stone-50 p-3 text-sm text-stone-600">
          You chose not to reply to this review.
          <button type="button" className="btn-ghost" disabled={pending} onClick={() => run(() => setIgnored(review.id, false))}>
            Undo
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <label htmlFor={`reply-${review.id}`} className="text-xs font-medium uppercase tracking-wide text-brand-700">
            {text ? "Suggested reply. Edit anything before posting." : "Reply"}
          </label>
          <textarea
            id={`reply-${review.id}`}
            className="input min-h-28"
            value={text}
            maxLength={MAX_REPLY_CHARS}
            onChange={(e) => setText(e.target.value)}
            placeholder={canAct ? "Write a reply, or let the AI draft one." : "Choose a plan to keep replying."}
            disabled={!canAct}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={!canAct || pending || !text.trim()} onClick={() => run(() => postReply(review.id, text))}>
              {pending ? "Working…" : "Post reply on Google"}
            </button>
            <button type="button" className="btn-secondary" disabled={!canAct || pending} onClick={() => run(() => regenerateDraft(review.id))}>
              {text ? "Write another" : "Draft with AI"}
            </button>
            {text && text !== review.draftReply && (
              <button type="button" className="btn-ghost" disabled={pending} onClick={() => run(() => saveDraft(review.id, text))}>
                Save draft
              </button>
            )}
            <button type="button" className="btn-ghost ml-auto" disabled={pending} onClick={() => run(() => setIgnored(review.id, true))}>
              Don&apos;t reply
            </button>
          </div>
        </div>
      )}
      {feedback && <p className={`mt-2 text-sm ${feedback.ok ? "text-brand-700" : "text-red-700"}`}>{feedback.text}</p>}
    </article>
  );
}
