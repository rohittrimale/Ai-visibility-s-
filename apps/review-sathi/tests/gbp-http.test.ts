import { describe, expect, it, vi } from "vitest";
import { DemoGbpClient, GbpApiError, HttpGbpClient } from "@/lib/google/gbp";

function mockFetch(handler: (url: string, init: RequestInit) => { status?: number; body?: unknown }) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const { status = 200, body = {} } = handler(String(url), init ?? {});
    return new Response(status === 204 ? null : JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
}

describe("HttpGbpClient", () => {
  it("lists locations across accounts with addresses", async () => {
    const fetchImpl = mockFetch((url) => {
      if (url.startsWith("https://mybusinessaccountmanagement.googleapis.com/v1/accounts")) return { body: { accounts: [{ name: "accounts/1" }] } };
      if (url.includes("/accounts/1/locations")) {
        return { body: { locations: [{ name: "locations/9", title: "Shop", storefrontAddress: { addressLines: ["MG Road"], locality: "Pune" } }] } };
      }
      return { status: 404 };
    });
    const client = new HttpGbpClient(async () => "token", fetchImpl);
    expect(await client.listLocations()).toEqual([{ name: "locations/9", accountName: "accounts/1", title: "Shop", address: "MG Road, Pune" }]);
  });

  it("pages through reviews and sends the bearer token", async () => {
    const fetchImpl = mockFetch((url, init) => {
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token");
      expect(url).toContain("https://mybusiness.googleapis.com/v4/accounts/1/locations/9/reviews");
      const page2 = url.includes("pageToken=p2");
      return {
        body: {
          reviews: [{ name: `r${page2 ? 2 : 1}`, starRating: "FIVE", createTime: "2026-11-01T00:00:00Z" }],
          nextPageToken: page2 ? undefined : "p2",
        },
      };
    });
    const client = new HttpGbpClient(async () => "token", fetchImpl);
    const reviews = await client.listReviews("accounts/1", "locations/9");
    expect(reviews.map((r) => r.name)).toEqual(["r1", "r2"]);
  });

  it("replies with PUT .../reply", async () => {
    let method = "";
    let body = "";
    const fetchImpl = mockFetch((url, init) => {
      expect(url).toBe("https://mybusiness.googleapis.com/v4/accounts/1/locations/9/reviews/abc/reply");
      method = String(init.method);
      body = String(init.body);
      return { body: { comment: "Thanks" } };
    });
    await new HttpGbpClient(async () => "t", fetchImpl).replyToReview("accounts/1/locations/9/reviews/abc", "Thanks");
    expect(method).toBe("PUT");
    expect(JSON.parse(body)).toEqual({ comment: "Thanks" });
  });

  it("creates a standard local post", async () => {
    const fetchImpl = mockFetch((url, init) => {
      expect(url).toBe("https://mybusiness.googleapis.com/v4/accounts/1/locations/9/localPosts");
      expect(JSON.parse(String(init.body))).toMatchObject({ summary: "Hello", topicType: "STANDARD" });
      return { body: { name: "accounts/1/locations/9/localPosts/p1" } };
    });
    expect(await new HttpGbpClient(async () => "t", fetchImpl).createPost("accounts/1", "locations/9", "Hello")).toEqual({
      name: "accounts/1/locations/9/localPosts/p1",
    });
  });

  it("throws GbpApiError with the status on failure", async () => {
    const client = new HttpGbpClient(async () => "t", mockFetch(() => ({ status: 403, body: { error: "denied" } })));
    await expect(client.replyToReview("accounts/1/locations/9/reviews/x", "hi")).rejects.toMatchObject({ status: 403 });
    await expect(client.replyToReview("accounts/1/locations/9/reviews/x", "hi")).rejects.toBeInstanceOf(GbpApiError);
  });
});

describe("DemoGbpClient", () => {
  it("returns stable review names so syncing twice does not duplicate", async () => {
    const client = new DemoGbpClient(() => new Date("2026-11-25T00:00:00Z"));
    const [location] = await client.listLocations();
    const a = await client.listReviews(location.accountName, location.name);
    const b = await client.listReviews(location.accountName, location.name);
    expect(a.map((r) => r.name)).toEqual(b.map((r) => r.name));
    expect(a.length).toBeGreaterThanOrEqual(5);
    expect(a.some((r) => r.starRating <= 2)).toBe(true);
  });
});
