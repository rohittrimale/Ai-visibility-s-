import { formatAddress, normalizeReview, type GbpLocation, type GbpReview } from "./types";

/**
 * Everything the app needs from Google Business Profile. Two implementations:
 * HttpGbpClient talks to Google; DemoGbpClient serves sample data so the
 * product works (and can be shown to shops) before Google approves API access.
 */
export interface GbpClient {
  listLocations(): Promise<GbpLocation[]>;
  listReviews(accountName: string, locationName: string, opts?: { maxPages?: number }): Promise<GbpReview[]>;
  replyToReview(reviewName: string, comment: string): Promise<void>;
  createPost(accountName: string, locationName: string, summary: string): Promise<{ name: string }>;
}

export class GbpApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GbpApiError";
  }
}

const ACCOUNTS_API = "https://mybusinessaccountmanagement.googleapis.com/v1";
const INFO_API = "https://mybusinessbusinessinformation.googleapis.com/v1";
const V4_API = "https://mybusiness.googleapis.com/v4";

/** Google resource names contain slashes we must keep, so encode each segment only. */
function path(name: string): string {
  return name
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export class HttpGbpClient implements GbpClient {
  constructor(
    private readonly getAccessToken: () => Promise<string>,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken();
    const res = await this.fetchImpl(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new GbpApiError(`Google API ${res.status}: ${text.slice(0, 300)}`, res.status);
    }
    if (res.status === 204) return {} as T;
    return (await res.json()) as T;
  }

  async listLocations(): Promise<GbpLocation[]> {
    const locations: GbpLocation[] = [];
    let accountsPage: string | undefined;
    do {
      const qs = new URLSearchParams({ pageSize: "20" });
      if (accountsPage) qs.set("pageToken", accountsPage);
      const accounts = await this.request<{ accounts?: { name: string }[]; nextPageToken?: string }>(
        `${ACCOUNTS_API}/accounts?${qs}`,
      );
      for (const account of accounts.accounts ?? []) {
        let locPage: string | undefined;
        do {
          const lqs = new URLSearchParams({ readMask: "name,title,storefrontAddress", pageSize: "100" });
          if (locPage) lqs.set("pageToken", locPage);
          const data = await this.request<{
            locations?: { name: string; title?: string; storefrontAddress?: Parameters<typeof formatAddress>[0] }[];
            nextPageToken?: string;
          }>(`${INFO_API}/${path(account.name)}/locations?${lqs}`);
          for (const loc of data.locations ?? []) {
            locations.push({
              name: loc.name,
              accountName: account.name,
              title: loc.title ?? "Untitled location",
              address: formatAddress(loc.storefrontAddress),
            });
          }
          locPage = data.nextPageToken;
        } while (locPage);
      }
      accountsPage = accounts.nextPageToken;
    } while (accountsPage);
    return locations;
  }

  async listReviews(accountName: string, locationName: string, opts: { maxPages?: number } = {}): Promise<GbpReview[]> {
    const maxPages = opts.maxPages ?? 4;
    const reviews: GbpReview[] = [];
    let pageToken: string | undefined;
    let pages = 0;
    do {
      const qs = new URLSearchParams({ pageSize: "50", orderBy: "updateTime desc" });
      if (pageToken) qs.set("pageToken", pageToken);
      const data = await this.request<{ reviews?: unknown[]; nextPageToken?: string }>(
        `${V4_API}/${path(accountName)}/${path(locationName)}/reviews?${qs}`,
      );
      for (const raw of data.reviews ?? []) {
        const review = normalizeReview(raw as Parameters<typeof normalizeReview>[0]);
        if (review) reviews.push(review);
      }
      pageToken = data.nextPageToken;
      pages += 1;
    } while (pageToken && pages < maxPages);
    return reviews;
  }

  async replyToReview(reviewName: string, comment: string): Promise<void> {
    await this.request(`${V4_API}/${path(reviewName)}/reply`, {
      method: "PUT",
      body: JSON.stringify({ comment }),
    });
  }

  async createPost(accountName: string, locationName: string, summary: string): Promise<{ name: string }> {
    const data = await this.request<{ name: string }>(`${V4_API}/${path(accountName)}/${path(locationName)}/localPosts`, {
      method: "POST",
      body: JSON.stringify({ languageCode: "en-IN", summary, topicType: "STANDARD" }),
    });
    return { name: data.name };
  }
}

// ---------------------------------------------------------------------------
// Demo mode
// ---------------------------------------------------------------------------

export const DEMO_ACCOUNT = "accounts/demo";

const DEMO_LOCATIONS: GbpLocation[] = [
  { name: "locations/demo-1", accountName: DEMO_ACCOUNT, title: "Sharma Sweets & Snacks", address: "FC Road, Pune, Maharashtra 411004" },
];

const DEMO_REVIEWS: Omit<GbpReview, "name" | "createTime" | "updateTime">[] = [
  { reviewerName: "Priya Kulkarni", starRating: 5, comment: "Best kaju katli in Pune! Fresh every time and the staff is very polite.", reply: null },
  { reviewerName: "Rahul Verma", starRating: 4, comment: "समोसे बहुत अच्छे थे, लेकिन शाम को थोड़ी भीड़ रहती है।", reply: null },
  { reviewerName: "Ankit Joshi", starRating: 2, comment: "Waited 25 minutes for my order on Sunday and the jalebi was cold. Expected better.", reply: null },
  { reviewerName: "Sneha Patil", starRating: 5, comment: "खूप छान मिठाई! दिवाळीसाठी इथूनच ऑर्डर करते.", reply: null },
  { reviewerName: null, starRating: 5, comment: null, reply: null },
  { reviewerName: "Vikram Singh", starRating: 1, comment: "Found a hair in my rasmalai. Very disappointed, staff did not even apologise.", reply: null },
  { reviewerName: "Meera Nair", starRating: 4, comment: "Dhokla was soft and tasty. Parking is a problem though.", reply: null },
  { reviewerName: "Arjun Mehta", starRating: 5, comment: "Bhai mast place hai, dahi vada must try!", reply: { comment: "Thank you Arjun ji! See you again soon.", updateTime: null } },
];

/**
 * Serves a fixed set of sample reviews, released a few at a time (based on the
 * day) so a demo account sees new reviews arrive over its first week.
 */
export class DemoGbpClient implements GbpClient {
  constructor(private readonly now: () => Date = () => new Date()) {}

  async listLocations(): Promise<GbpLocation[]> {
    return DEMO_LOCATIONS;
  }

  async listReviews(accountName: string, locationName: string): Promise<GbpReview[]> {
    const now = this.now().getTime();
    const dayIndex = Math.floor(now / 86_400_000);
    const visible = Math.min(DEMO_REVIEWS.length, 5 + (dayIndex % 4));
    return DEMO_REVIEWS.slice(0, visible).map((review, i) => {
      const created = new Date(now - (i + 1) * 9 * 3_600_000).toISOString();
      return {
        ...review,
        name: `${accountName}/${locationName}/reviews/demo-${i + 1}`,
        createTime: created,
        updateTime: created,
      };
    });
  }

  async replyToReview(): Promise<void> {
    // Nothing to send in demo mode.
  }

  async createPost(accountName: string, locationName: string): Promise<{ name: string }> {
    return { name: `${accountName}/${locationName}/localPosts/demo-${this.now().getTime()}` };
  }
}
