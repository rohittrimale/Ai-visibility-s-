import type { Metadata } from "next";
import Link from "next/link";
import { Notice, Stars } from "@/components/ui";
import { requireOrg } from "@/lib/data/session";
import { ReviewCard, type ReviewItem } from "./review-card";
import { SyncButton } from "./sync-button";

export const metadata: Metadata = { title: "Reviews" };

const FILTERS = [
  { id: "todo", label: "Needs reply" },
  { id: "negative", label: "Low ratings" },
  { id: "posted", label: "Replied" },
  { id: "all", label: "All" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

export default async function ReviewsPage({ searchParams }: PageProps<"/dashboard">) {
  const params = await searchParams;
  const filter: FilterId = FILTERS.some((f) => f.id === params.filter) ? (params.filter as FilterId) : "todo";
  const ctx = await requireOrg();
  const { supabase, org } = ctx;

  const { count: locationCount } = await supabase.from("locations").select("id", { count: "exact", head: true }).eq("org_id", org.id);

  let query = supabase
    .from("reviews")
    .select("id, reviewer_name, star_rating, comment, review_created_at, reply_text, draft_reply, status, error, locations(title)")
    .eq("org_id", org.id)
    .order("review_created_at", { ascending: false })
    .limit(50);
  if (filter === "todo") query = query.in("status", ["new", "drafted", "failed"]);
  if (filter === "negative") query = query.lte("star_rating", org.negative_threshold).in("status", ["new", "drafted", "failed"]);
  if (filter === "posted") query = query.in("status", ["posted", "replied_elsewhere"]);
  const { data: rows } = await query;

  const { data: ratings } = await supabase.from("reviews").select("star_rating, status").eq("org_id", org.id).limit(5000);
  const total = ratings?.length ?? 0;
  const average = total ? (ratings!.reduce((sum, r) => sum + r.star_rating, 0) / total).toFixed(1) : "–";
  const pending = ratings?.filter((r) => ["new", "drafted", "failed"].includes(r.status)).length ?? 0;
  const replied = ratings?.filter((r) => r.status === "posted" || r.status === "replied_elsewhere").length ?? 0;
  const replyRate = total ? Math.round((replied / total) * 100) : 0;

  const reviews: ReviewItem[] = (rows ?? []).map((row) => ({
    id: row.id,
    reviewerName: row.reviewer_name,
    starRating: row.star_rating,
    comment: row.comment,
    createdAt: row.review_created_at,
    replyText: row.reply_text,
    draftReply: row.draft_reply,
    status: row.status,
    error: row.error,
    locationTitle: (row.locations as unknown as { title: string } | null)?.title ?? "",
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Reviews</h1>
        <SyncButton disabled={!ctx.access.allowed || !locationCount} />
      </div>

      {!locationCount && (
        <Notice tone="info">
          Connect your Google Business Profile to start.{" "}
          <Link href="/dashboard/settings" className="font-medium underline">
            Go to Settings
          </Link>
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Average rating" value={average} extra={total ? <Stars rating={Math.round(Number(average))} size="text-sm" /> : null} />
        <Stat label="Total reviews" value={String(total)} />
        <Stat label="Waiting for reply" value={String(pending)} />
        <Stat label="Reply rate" value={`${replyRate}%`} />
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={f.id === "todo" ? "/dashboard" : `/dashboard?filter=${f.id}`}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-sm ${filter === f.id ? "bg-stone-900 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200"}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {reviews.length === 0 ? (
        <div className="card text-center text-stone-600">
          {filter === "todo" ? "You're all caught up. New reviews will appear here with a reply ready." : "No reviews here yet."}
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} canAct={ctx.access.allowed} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, extra }: { label: string; value: string; extra?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 flex items-baseline gap-2 text-2xl font-semibold">
        {value} {extra}
      </p>
    </div>
  );
}
