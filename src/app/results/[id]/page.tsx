import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Disclaimer } from "@/components/Disclaimer";
import { EngineBars } from "@/components/EngineBars";
import { PromptTable } from "@/components/PromptTable";
import { ScoreRing } from "@/components/ScoreRing";
import { UnlockForm } from "@/components/UnlockForm";
import { loadReport, promptRows } from "@/lib/report";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your AI Visibility Score", robots: { index: false, follow: false } };

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await loadReport(getStore(), id);
  if (!r) notFound();
  const { check, business } = r;
  const rep = check.report!;
  const unlocked = check.unlocked;
  const engines = rep.engines.filter((e) => check.engine_scores?.[e]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <div>
        <p className="text-sm text-slate-500">{business.category} · {business.city}</p>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{business.name}</h1>
      </div>

      <section className="card flex flex-col items-center gap-6 sm:flex-row">
        <ScoreRing score={check.score ?? 0} />
        <div className="text-center sm:text-left">
          <h2 className="text-xl font-bold">Your AI Visibility Score</h2>
          <p className="mt-1 text-slate-600">
            You were recommended in <b className="text-slate-900">{rep.mentionedCount}</b> of <b className="text-slate-900">{rep.totalCount}</b> AI answers we tested.
            Earlier positions in a list score higher.
          </p>
          <Disclaimer className="mt-2" />
        </div>
      </section>

      <section className="card">
        <h2 className="mb-4 text-lg font-bold">Score by AI engine</h2>
        <EngineBars engines={check.engine_scores!} />
      </section>

      {unlocked ? (
        <>
          <section className="card">
            <h2 className="mb-1 text-lg font-bold">Which questions mentioned you</h2>
            <p className="mb-3 text-sm text-slate-500">#1, #2… is your position in the AI's list. ✗ means not mentioned.</p>
            <PromptTable rows={promptRows(r.results)} engines={engines} />
          </section>

          <section className="card">
            <h2 className="mb-3 text-lg font-bold">Competitors recommended instead</h2>
            {rep.topCompetitors.length ? (
              <ul className="divide-y divide-slate-100">
                {rep.topCompetitors.map((c) => (
                  <li key={c.name} className="flex justify-between py-2 text-sm"><span className="font-medium">{c.name}</span><span className="text-slate-500">appeared {c.count}×</span></li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-500">No clear competitors detected in the answers.</p>}
          </section>

          <section className="card">
            <h2 className="mb-3 text-lg font-bold">What to do next</h2>
            <ol className="space-y-3">
              {rep.tips.map((t, i) => (
                <li key={i} className="flex gap-3 text-sm text-slate-700">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span>{t}
                </li>
              ))}
            </ol>
          </section>

          <div className="flex flex-wrap gap-3">
            <Link href={`/report/${check.id}/print`} className="btn-ghost">Printable / PDF version</Link>
            <Link href="/#check" className="btn-ghost">Check another business</Link>
          </div>
        </>
      ) : (
        <>
          <section className="card">
            <h2 className="mb-2 text-lg font-bold">A first tip</h2>
            <p className="text-sm text-slate-700">{rep.tips[0]}</p>
          </section>

          <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div aria-hidden className="pointer-events-none select-none space-y-3 p-6 opacity-60 blur-sm">
              <h2 className="text-lg font-bold">Which questions mentioned you</h2>
              {["best business in your city", "top rated near me", "affordable option nearby", "most trusted"].map((p) => (
                <div key={p} className="flex justify-between border-b border-slate-100 pb-2 text-sm"><span>“{p}”</span><span>#2 · ✗ · #4</span></div>
              ))}
              <h2 className="pt-2 text-lg font-bold">Competitors recommended instead</h2>
              <div className="h-4 w-2/3 rounded bg-slate-200" /><div className="h-4 w-1/2 rounded bg-slate-200" />
              <h2 className="pt-2 text-lg font-bold">What to do next</h2>
              <div className="h-4 w-full rounded bg-slate-200" /><div className="h-4 w-5/6 rounded bg-slate-200" />
            </div>
            <div className="absolute inset-0 grid place-items-center bg-white/70 p-4">
              <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
                <h2 className="text-lg font-bold">Unlock your full report</h2>
                <p className="mb-4 mt-1 text-sm text-slate-600">
                  See every question, the competitors winning instead, and {rep.tips.length - 1} more tips. We'll email you a copy.
                </p>
                <UnlockForm checkId={check.id} />
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
