import { describe, expect, it } from "vitest";
import type { Drafter } from "@/lib/ai/generate";
import type { GbpClient } from "@/lib/google/gbp";
import type { GbpReview } from "@/lib/google/types";
import { MAX_DRAFTS_PER_RUN, syncLocation, type NewReviewRow, type StoredReview, type SyncLocation, type SyncStore } from "@/lib/sync/sync-location";

const NOW = new Date("2026-11-25T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

class MemoryStore implements SyncStore {
  rows: (NewReviewRow & { id: string })[] = [];
  async listReviews(locationId: string): Promise<StoredReview[]> {
    return this.rows.filter((r) => r.location_id === locationId);
  }
  async insertReview(row: NewReviewRow) {
    this.rows.push({ ...row, id: `id-${this.rows.length + 1}` });
  }
  async updateReview(id: string, patch: Partial<NewReviewRow>) {
    const row = this.rows.find((r) => r.id === id);
    if (row) Object.assign(row, patch);
  }
  byName(name: string) {
    return this.rows.find((r) => r.google_review_name === name)!;
  }
}

class FakeGbp implements GbpClient {
  replies: { name: string; comment: string }[] = [];
  failReplies = false;
  constructor(public reviews: GbpReview[]) {}
  async listLocations() {
    return [];
  }
  async listReviews() {
    return this.reviews;
  }
  async replyToReview(name: string, comment: string) {
    if (this.failReplies) throw new Error("Google API 500");
    this.replies.push({ name, comment });
  }
  async createPost() {
    return { name: "p" };
  }
}

const drafter = (fail = false): Drafter & { calls: number } => {
  const d = {
    calls: 0,
    async reply(input: Parameters<Drafter["reply"]>[0]) {
      d.calls += 1;
      if (fail) throw new Error("AI down");
      return `Thanks ${input.review.reviewerName ?? "friend"} (${input.review.starRating})`;
    },
    async post() {
      return "post";
    },
  };
  return d;
};

const review = (name: string, stars: number, createdHoursAgo: number, extra: Partial<GbpReview> = {}): GbpReview => ({
  name,
  reviewerName: `R-${name}`,
  starRating: stars,
  comment: `comment ${name}`,
  createTime: hoursAgo(createdHoursAgo),
  updateTime: hoursAgo(createdHoursAgo),
  reply: null,
  ...extra,
});

const org = { id: "org1", name: "Sharma Sweets", business_type: "sweet shop", city: "Pune", negative_threshold: 3 };
const location = (overrides: Partial<SyncLocation> = {}): SyncLocation => ({
  id: "loc1",
  org_id: "org1",
  title: "Sharma Sweets",
  google_account_name: "accounts/1",
  google_location_name: "locations/1",
  reply_mode: "auto_positive",
  reply_language: "auto",
  tone: "warm",
  signature: null,
  extra_instructions: null,
  last_synced_at: hoursAgo(1),
  ...overrides,
});

describe("syncLocation", () => {
  it("drafts new reviews, auto-posts good ones and alerts on bad ones", async () => {
    const gbp = new FakeGbp([review("good", 5, 0.5), review("bad", 1, 0.5)]);
    const store = new MemoryStore();
    const result = await syncLocation({ org, location: location(), gbp, drafter: drafter(), store, now: NOW });

    expect(result).toMatchObject({ fetched: 2, inserted: 2, drafted: 2, autoPosted: 1 });
    expect(store.byName("good")).toMatchObject({ status: "posted", reply_text: "Thanks R-good (5)" });
    expect(store.byName("bad")).toMatchObject({ status: "drafted", reply_text: null, draft_reply: "Thanks R-bad (1)" });
    expect(store.byName("bad").alerted_at).not.toBeNull();
    expect(gbp.replies).toEqual([{ name: "good", comment: "Thanks R-good (5)" }]);
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0]).toMatchObject({ starRating: 1, draftReply: "Thanks R-bad (1)" });
  });

  it("is idempotent: a second run inserts nothing", async () => {
    const gbp = new FakeGbp([review("a", 5, 0.5), review("b", 2, 0.5)]);
    const store = new MemoryStore();
    const d = drafter();
    await syncLocation({ org, location: location(), gbp, drafter: d, store, now: NOW });
    const second = await syncLocation({ org, location: location(), gbp, drafter: d, store, now: NOW });
    expect(second).toMatchObject({ inserted: 0, drafted: 0, autoPosted: 0, alerts: [] });
    expect(store.rows).toHaveLength(2);
    expect(gbp.replies).toHaveLength(1);
  });

  it("does not auto-post or alert on the first sync's existing reviews", async () => {
    const gbp = new FakeGbp([review("old-good", 5, 24 * 10), review("old-bad", 1, 24 * 10)]);
    const store = new MemoryStore();
    const result = await syncLocation({ org, location: location({ last_synced_at: null }), gbp, drafter: drafter(), store, now: NOW });
    expect(result.autoPosted).toBe(0);
    expect(result.alerts).toHaveLength(0);
    expect(store.byName("old-good").status).toBe("drafted");
  });

  it("leaves very old backlog undrafted on the first sync", async () => {
    const gbp = new FakeGbp([review("ancient", 5, 24 * 200)]);
    const store = new MemoryStore();
    const d = drafter();
    await syncLocation({ org, location: location({ last_synced_at: null }), gbp, drafter: d, store, now: NOW });
    expect(d.calls).toBe(0);
    expect(store.byName("ancient")).toMatchObject({ status: "new", draft_reply: null });
  });

  it("records reviews already answered on Google without drafting", async () => {
    const gbp = new FakeGbp([review("answered", 4, 2, { reply: { comment: "Owner reply", updateTime: hoursAgo(1) } })]);
    const store = new MemoryStore();
    const d = drafter();
    await syncLocation({ org, location: location(), gbp, drafter: d, store, now: NOW });
    expect(d.calls).toBe(0);
    expect(store.byName("answered")).toMatchObject({ status: "replied_elsewhere", reply_text: "Owner reply" });
  });

  it("mirrors a reply the owner wrote directly on Google later", async () => {
    const gbp = new FakeGbp([review("x", 3, 2)]);
    const store = new MemoryStore();
    await syncLocation({ org, location: location({ reply_mode: "manual" }), gbp, drafter: drafter(), store, now: NOW });
    expect(store.byName("x").status).toBe("drafted");
    gbp.reviews = [review("x", 3, 2, { reply: { comment: "Replied in the Google app", updateTime: hoursAgo(0.1) } })];
    await syncLocation({ org, location: location({ reply_mode: "manual" }), gbp, drafter: drafter(), store, now: NOW });
    expect(store.byName("x")).toMatchObject({ status: "replied_elsewhere", reply_text: "Replied in the Google app", draft_reply: null });
  });

  it("redrafts when a customer edits an unanswered review", async () => {
    const gbp = new FakeGbp([review("e", 2, 5)]);
    const store = new MemoryStore();
    await syncLocation({ org, location: location({ reply_mode: "manual" }), gbp, drafter: drafter(), store, now: NOW });
    gbp.reviews = [review("e", 5, 5, { comment: "They fixed it, great now", updateTime: hoursAgo(0.2) })];
    await syncLocation({ org, location: location({ reply_mode: "manual" }), gbp, drafter: drafter(), store, now: NOW });
    expect(store.byName("e")).toMatchObject({ star_rating: 5, comment: "They fixed it, great now", draft_reply: "Thanks R-e (5)", status: "drafted" });
  });

  it("keeps going when the AI fails, and retries on the next run", async () => {
    const gbp = new FakeGbp([review("f", 5, 0.5)]);
    const store = new MemoryStore();
    const first = await syncLocation({ org, location: location(), gbp, drafter: drafter(true), store, now: NOW });
    expect(first.errors).toEqual(["AI down"]);
    expect(store.byName("f")).toMatchObject({ status: "new", draft_reply: null, error: "AI down" });
    const second = await syncLocation({ org, location: location(), gbp, drafter: drafter(), store, now: NOW });
    expect(second.drafted).toBe(1);
    expect(store.byName("f")).toMatchObject({ status: "drafted", error: null });
  });

  it("keeps the draft when auto-posting fails", async () => {
    const gbp = new FakeGbp([review("g", 5, 0.5)]);
    gbp.failReplies = true;
    const store = new MemoryStore();
    const result = await syncLocation({ org, location: location(), gbp, drafter: drafter(), store, now: NOW });
    expect(result.autoPosted).toBe(0);
    expect(store.byName("g")).toMatchObject({ status: "drafted", draft_reply: "Thanks R-g (5)" });
    expect(store.byName("g").error).toMatch(/Auto-post failed/);
  });

  it("caps AI drafts per run, newest first", async () => {
    const reviews = Array.from({ length: MAX_DRAFTS_PER_RUN + 5 }, (_, i) => review(`n${i}`, 5, i + 1));
    const store = new MemoryStore();
    const d = drafter();
    await syncLocation({ org, location: location({ reply_mode: "manual" }), gbp: new FakeGbp(reviews), drafter: d, store, now: NOW });
    expect(d.calls).toBe(MAX_DRAFTS_PER_RUN);
    expect(store.byName("n0").status).toBe("drafted");
    expect(store.byName(`n${MAX_DRAFTS_PER_RUN + 4}`).status).toBe("new");
  });
});
