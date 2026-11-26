import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui";
import { requireOrg } from "@/lib/data/session";
import { env } from "@/lib/env";
import { qrSvg } from "@/lib/qr";
import { shortReviewLink } from "@/lib/reviews/requests";
import { CopyButton, QrDownload, ReviewLinkForm, WhatsAppRequest } from "./tools";

export const metadata: Metadata = { title: "Get more reviews" };

export default async function GrowPage() {
  const ctx = await requireOrg();
  const { data: locations } = await ctx.supabase
    .from("locations")
    .select("id, title, google_review_url, custom_review_url, short_code, review_link_clicks")
    .eq("org_id", ctx.org.id)
    .eq("enabled", true)
    .order("created_at");

  const appUrl = env.appUrl();
  const items = await Promise.all(
    (locations ?? []).map(async (location) => {
      const shortLink = shortReviewLink(appUrl, location.short_code);
      return { ...location, shortLink, svg: await qrSvg(shortLink), target: location.custom_review_url ?? location.google_review_url };
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Get more reviews</h1>
        <p className="mt-1 text-stone-600">
          More recent reviews help you show up higher on Google Maps. Put the QR code on your counter and send the WhatsApp message after every
          visit.
        </p>
      </div>

      {items.length === 0 && (
        <Notice tone="info">
          Connect Google and turn on a location in{" "}
          <Link href="/dashboard/settings" className="font-medium underline">
            Settings
          </Link>{" "}
          first.
        </Notice>
      )}

      {items.map((item) => (
        <section key={item.id} className="space-y-4">
          {items.length > 1 && <h2 className="text-lg font-semibold">{item.title}</h2>}

          <div className="card space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-stone-700">Your review link</p>
                <p className="mt-1 break-all font-mono text-sm text-brand-800">{item.shortLink}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold">{item.review_link_clicks}</p>
                <p className="text-xs text-stone-500">times opened</p>
              </div>
            </div>
            {item.target ? (
              <p className="text-xs text-stone-500">
                Opens Google&apos;s &quot;Write a review&quot; page for {item.title}.
              </p>
            ) : (
              <Notice tone="warn">
                We couldn&apos;t get your review link from Google yet. Open your Business Profile on Google, tap <strong>Ask for reviews</strong>,
                copy the link and paste it below.
              </Notice>
            )}
            <div className="flex flex-wrap gap-2">
              <CopyButton text={item.shortLink} label="Copy link" />
            </div>
            <ReviewLinkForm id={item.id} customUrl={item.custom_review_url} disabled={ctx.role !== "owner"} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="card flex flex-col items-center gap-3 text-center">
              <p className="self-start text-sm font-medium text-stone-700">QR code for your counter</p>
              <div className="w-48 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: item.svg }} />
              <div className="flex flex-wrap justify-center gap-2">
                <Link href={`/poster/${item.id}`} target="_blank" className="btn-primary">
                  Print poster
                </Link>
                <QrDownload text={item.shortLink} filename={`${item.title}-review-qr.png`} />
              </div>
              <p className="text-xs text-stone-500">Customers scan it with their phone camera and land on the review box.</p>
            </div>
            <WhatsAppRequest businessName={item.title} link={item.shortLink} />
          </div>
        </section>
      ))}

      <Notice tone="info">
        <strong>Stay within Google&apos;s rules:</strong> ask every customer, not only happy ones, and never offer discounts or gifts for reviews.
        Google can remove reviews or suspend profiles that break these rules.
      </Notice>
    </div>
  );
}
