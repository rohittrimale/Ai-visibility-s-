import type { Metadata } from "next";
import Link from "next/link";
import { auditPriceInr } from "@/lib/billing/audit";
import { PLANS } from "@/lib/billing/plans";

export const metadata: Metadata = {
  title: "AI Visibility Reports for Agencies",
  description: "Win local clients with a free AI visibility check, then sell white-label Deep Audits and monthly AI visibility tracking.",
  alternates: { canonical: "/agencies" },
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function Agencies() {
  const audit = auditPriceInr();
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  const growth = PLANS.growth;
  const steps = [
    ["Open the conversation", "Run a free check on a prospect's business. “ChatGPT recommends your 3 competitors, not you” is the easiest cold opener you'll ever send."],
    ["Sell the fix", `Buy a Deep Audit (${inr(audit)}) and present the 4-week action plan as your own proposal. Most agencies charge ₹10,000-25,000 for this work.`],
    ["Keep them on retainer", `Track every client weekly with the ${growth.name} plan and send branded monthly reports showing the score going up.`],
  ];
  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-12">
      <section>
        <p className="mb-3 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">For SEO & marketing agencies</p>
        <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">Sell AI visibility to your local clients</h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          Business owners are hearing that customers ask ChatGPT who to choose, and they don't know where they stand.
          Show them in a minute, then sell the fix and the monthly tracking under your own brand.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/#check" className="btn">Run a free check on a prospect</Link>
          {contact && <a href={`mailto:${contact}?subject=AI%20visibility%20partner%20plan`} className="btn-ghost">Ask about partner pricing</a>}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold">How agencies make money with it</h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-3">
          {steps.map(([t, d], i) => (
            <li key={t} className="card">
              <div className="mb-2 grid h-8 w-8 place-items-center rounded-full bg-brand-50 font-bold text-brand-700">{i + 1}</div>
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-slate-600">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="card">
          <h2 className="text-lg font-bold">Deep Audit</h2>
          <p className="mt-1 text-3xl font-extrabold">{inr(audit)}<span className="text-base font-medium text-slate-500"> one-time</span></p>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
            <li>✓ 30 questions × ChatGPT, Gemini, Perplexity</li>
            <li>✓ Competitors and cited sources</li>
            <li>✓ 4-week action plan, printable PDF</li>
          </ul>
        </div>
        <div className="card">
          <h2 className="text-lg font-bold">{growth.name} tracking</h2>
          <p className="mt-1 text-3xl font-extrabold">{inr(growth.priceInr)}<span className="text-base font-medium text-slate-500">/mo</span></p>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
            {growth.features.map((f) => <li key={f}>✓ {f}</li>)}
          </ul>
        </div>
      </section>

      <p className="text-sm text-slate-500">
        Tools like this cost agencies $95-500 a month elsewhere, priced in dollars and built for big brands. This one is built for local businesses and priced for India.
      </p>
    </div>
  );
}
