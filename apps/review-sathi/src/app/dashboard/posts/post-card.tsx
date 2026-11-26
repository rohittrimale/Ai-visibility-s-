"use client";

import { useState, useTransition } from "react";
import { MAX_POST_CHARS } from "@/lib/reviews/policy";
import { draftPostNow, publishPost, savePost, skipPost } from "../actions";

export type PostItem = {
  id: string;
  weekStart: string;
  text: string;
  status: string;
  error: string | null;
  postedAt: string | null;
  locationTitle: string;
};

function weekLabel(weekStart: string) {
  return new Date(`${weekStart}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function PostCard({ post, canAct }: { post: PostItem; canAct: boolean }) {
  const [text, setText] = useState(post.text);
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(post.error ? { ok: false, text: post.error } : null);
  const editable = post.status === "draft" || post.status === "failed";

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    setFeedback(null);
    start(async () => {
      const result = await fn();
      setFeedback(result.ok ? (result.message ? { ok: true, text: result.message } : null) : { ok: false, text: result.error ?? "Something went wrong." });
    });
  }

  return (
    <article className="card">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium">
          Week of {weekLabel(post.weekStart)} · {post.locationTitle}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${post.status === "posted" ? "bg-brand-100 text-brand-800" : post.status === "skipped" ? "bg-stone-100 text-stone-600" : "bg-amber-100 text-amber-800"}`}
        >
          {post.status === "posted" ? "Live on Google" : post.status === "skipped" ? "Skipped" : "Draft"}
        </span>
      </div>
      {editable ? (
        <>
          <textarea className="input min-h-32" value={text} maxLength={MAX_POST_CHARS} onChange={(e) => setText(e.target.value)} disabled={!canAct} />
          <p className="mt-1 text-right text-xs text-stone-500">
            {text.length}/{MAX_POST_CHARS}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={!canAct || pending} onClick={() => run(() => publishPost(post.id, text))}>
              {pending ? "Working…" : "Publish on Google"}
            </button>
            {text !== post.text && (
              <button type="button" className="btn-ghost" disabled={pending} onClick={() => run(() => savePost(post.id, text))}>
                Save
              </button>
            )}
            <button type="button" className="btn-ghost ml-auto" disabled={pending} onClick={() => run(() => skipPost(post.id))}>
              Skip this week
            </button>
          </div>
        </>
      ) : (
        <p className="whitespace-pre-wrap text-stone-800">{post.text}</p>
      )}
      {feedback && <p className={`mt-2 text-sm ${feedback.ok ? "text-brand-700" : "text-red-700"}`}>{feedback.text}</p>}
    </article>
  );
}

export function DraftNowButton({ locationId, title, disabled, multiple }: { locationId: string; title: string; disabled: boolean; multiple: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="btn-secondary"
        disabled={disabled || pending}
        onClick={() =>
          start(async () => {
            const result = await draftPostNow(locationId);
            setMessage(result.ok ? null : result.error);
          })
        }
      >
        {pending ? "Writing…" : multiple ? `Draft this week's post for ${title}` : "Draft this week's post now"}
      </button>
      {message && <span className="text-sm text-red-700">{message}</span>}
    </div>
  );
}
