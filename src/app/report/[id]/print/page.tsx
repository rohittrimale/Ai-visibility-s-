import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { PromptTable } from "@/components/PromptTable";
import { engineLabel } from "@/lib/providers";
import { loadReport, promptRows } from "@/lib/report";
import { getStore } from "@/lib/store";
import { sanitizeText } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI Visibility Report", robots: { index: false, follow: false } };

/**
 * Print-optimised report; use the browser's "Save as PDF".
 * White-label (agency) options via ?brand=Agency%20Name&color=%231d4ed8 apply only when paid features are enabled.
 */
export default async function PrintReport({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ brand?: string; color?: string }> }) {
  const [{ id }, q] = await Promise.all([params, searchParams]);
  const r = await loadReport(getStore(), id);
  if (!r || !r.check.unlocked) notFound();

  const white = process.env.NEXT_PUBLIC_PAID_ENABLED === "1";
  const brand = white && q.brand ? sanitizeText(q.brand).slice(0, 60) : "AI Visibility Checker";
  const color = white && /^#[0-9a-f]{6}$/i.test(q.color ?? "") ? q.color! : "#1d4ed8";
  const { check, business } = r;
  const rep = check.report!;
  const engines = rep.engines.filter((e) => check.engine_scores?.[e]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 bg-white px-6 py-8">
      <div className="flex items-center justify-between border-b-4 pb-3" style={{ borderColor: color }}>
        <span className="text-lg font-bold" style={{ color }}>{brand}</span>
        <PrintButton />
      </div>
      <div>
        <h1 className="text-2xl font-extrabold">AI Visibility Report: {business.name}</h1>
        <p className="text-slate-600">{business.category} · {business.city} · {new Date(check.created_at).toLocaleDateString("en-IN")}</p>
      </div>
      <p className="text-5xl font-extrabold" style={{ color }}>{check.score}<span className="text-xl text-slate-500">/100</span></p>
      <ul className="text-sm">
        {Object.entries(check.engine_scores!).map(([e, v]) => (
          <li key={e}>{engineLabel(e)}: <b>{v.score}/100</b> ({v.mentioned} of {v.total} answers)</li>
        ))}
      </ul>
      <h2 className="text-lg font-bold">Questions tested</h2>
      <PromptTable rows={promptRows(r.results)} engines={engines} />
      <h2 className="text-lg font-bold">Competitors recommended instead</h2>
      <p className="text-sm">{rep.topCompetitors.map((c) => `${c.name} (${c.count}×)`).join(", ") || "None detected"}</p>
      <h2 className="text-lg font-bold">Recommendations</h2>
      <ol className="list-decimal space-y-2 pl-5 text-sm">{rep.tips.map((t, i) => <li key={i}>{t}</li>)}</ol>
      <p className="border-t pt-3 text-xs text-slate-500">AI answers vary by user and location; this is an estimate.</p>
    </div>
  );
}
