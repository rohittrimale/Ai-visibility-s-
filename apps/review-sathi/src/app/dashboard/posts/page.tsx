import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui";
import { requireOrg } from "@/lib/data/session";
import { DraftNowButton, PostCard, type PostItem } from "./post-card";

export const metadata: Metadata = { title: "Weekly posts" };

export default async function PostsPage() {
  const ctx = await requireOrg();
  const { supabase, org } = ctx;
  const [{ data: locations }, { data: rows }] = await Promise.all([
    supabase.from("locations").select("id, title").eq("org_id", org.id).eq("enabled", true).order("created_at"),
    supabase
      .from("posts")
      .select("id, week_start, draft_text, status, error, posted_at, locations(title)")
      .eq("org_id", org.id)
      .order("week_start", { ascending: false })
      .limit(20),
  ]);

  const posts: PostItem[] = (rows ?? []).map((row) => ({
    id: row.id,
    weekStart: row.week_start,
    text: row.draft_text,
    status: row.status,
    error: row.error,
    postedAt: row.posted_at,
    locationTitle: (row.locations as unknown as { title: string } | null)?.title ?? "",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Weekly posts</h1>
        <p className="mt-1 text-stone-600">
          Every Monday morning we draft a fresh post for your Google profile. Active profiles tend to show up more on Google Maps. Review it,
          edit it and publish.
        </p>
      </div>

      {!locations?.length ? (
        <Notice tone="info">
          Connect Google and turn on a location in{" "}
          <Link href="/dashboard/settings" className="font-medium underline">
            Settings
          </Link>{" "}
          to get weekly posts.
        </Notice>
      ) : (
        <div className="flex flex-wrap gap-2">
          {locations.map((location) => (
            <DraftNowButton key={location.id} locationId={location.id} title={location.title} disabled={!ctx.access.allowed} multiple={locations.length > 1} />
          ))}
        </div>
      )}

      {posts.length === 0 ? (
        <div className="card text-center text-stone-600">No posts yet. Your first draft arrives next Monday, or draft one now.</div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} canAct={ctx.access.allowed} />
          ))}
        </div>
      )}
    </div>
  );
}
