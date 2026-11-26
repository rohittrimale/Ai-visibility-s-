import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/data/session";
import { env } from "@/lib/env";
import { qrSvg } from "@/lib/qr";
import { shortReviewLink } from "@/lib/reviews/requests";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Review poster" };

/** A printable A4 counter poster with the review QR code. */
export default async function PosterPage({ params }: PageProps<"/poster/[id]">) {
  const { id } = await params;
  const ctx = await requireOrg();
  const { data: location } = await ctx.supabase.from("locations").select("id, title, short_code").eq("id", id).maybeSingle();
  if (!location) notFound();

  const link = shortReviewLink(env.appUrl(), location.short_code);
  const svg = await qrSvg(link);

  return (
    <main className="flex flex-1 flex-col items-center bg-white px-4 py-8 print:p-0">
      <div className="mb-6 flex gap-2 print:hidden">
        <PrintButton />
      </div>
      <article className="flex w-full max-w-[180mm] flex-col items-center rounded-3xl border-4 border-brand-700 px-8 py-10 text-center print:min-h-[260mm] print:justify-center print:border-[6px]">
        <p className="text-lg font-medium uppercase tracking-widest text-brand-700">{location.title}</p>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-stone-900 sm:text-5xl">How was your visit?</h1>
        <p className="mt-2 text-2xl text-stone-700">आपका अनुभव कैसा रहा?</p>
        <div className="my-8 w-64 sm:w-80 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="text-2xl font-semibold text-stone-900">Scan to review us on Google</p>
        <p className="mt-1 text-xl text-stone-700">Google पर review देने के लिए scan करें</p>
        <p className="mt-6 text-sm text-stone-500">Takes less than a minute. Thank you! 🙏</p>
      </article>
    </main>
  );
}
