import Link from "next/link";
import { CheckForm } from "./CheckForm";
import { NICHES, type Niche } from "@/lib/niches";

const STEPS = [
  ["Tell us about your business", "Name, website, city and category. Add competitors if you like."],
  ["We ask the AIs for you", "8 realistic customer questions, asked to ChatGPT, Gemini and Perplexity."],
  ["See where you stand", "Your visibility score, who gets recommended instead, and what to fix."],
];

export function Landing({ niche }: { niche?: Niche }) {
  return (
    <>
      <section className="bg-gradient-to-b from-brand-50 to-slate-50">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 sm:py-16 lg:grid-cols-2 lg:items-start">
          <div className="pt-2">
            <p className="mb-3 inline-block rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
              Free · takes about a minute
            </p>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl">
              {niche ? niche.h1 : "Does ChatGPT recommend your business?"}
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              {niche
                ? niche.description
                : "Customers increasingly ask ChatGPT, Gemini and Perplexity who to choose. Find out if they're sending people to you or to your competitors."}
            </p>
            <ul className="mt-6 space-y-2 text-slate-700">
              {["Your 0–100 AI Visibility Score", "Which AI engines mention you (and which don't)", "Competitors recommended instead", "Plain-English tips to improve"].map((t) => (
                <li key={t} className="flex gap-2"><span className="text-green-600">✓</span>{t}</li>
              ))}
            </ul>
            {niche && (
              <div className="mt-6">
                <p className="text-sm font-semibold text-slate-700">Questions we test, for example:</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {niche.examplePrompts.map((p) => <li key={p}>“{p}”</li>)}
                </ul>
              </div>
            )}
          </div>
          <div id="check" className="scroll-mt-6"><CheckForm defaultCategory={niche?.category} /></div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-2xl font-bold">How it works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="card">
              <div className="mb-2 grid h-8 w-8 place-items-center rounded-full bg-brand-50 font-bold text-brand-700">{i + 1}</div>
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-slate-600">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-5xl px-4">
        <div className="card">
          <h2 className="text-xl font-bold">Why AI visibility matters</h2>
          <p className="mt-2 text-slate-600">
            Search is shifting from a list of links to a single recommended answer. If an AI doesn't name your business, those customers may never see you.
            This check is an estimate, and AI answers vary by user and location, but it shows you where you stand today.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {NICHES.map((n) => (
              <Link key={n.slug} href={`/${n.slug}`} className="btn-ghost">AI visibility for {n.plural}</Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
