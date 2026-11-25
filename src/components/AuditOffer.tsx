"use client";
import { useState } from "react";

const INCLUDES = [
  "30 customer questions (vs 8 free) on ChatGPT, Gemini and Perplexity",
  "Every competitor AI recommends instead, and how often",
  "The exact sites AI engines cite for your category in your city",
  "A week-by-week 4-week action plan written for your business",
  "Emailed report + printable PDF",
];

export function AuditOffer({ checkId, priceInr, businessName }: { checkId: string; priceInr: number; businessName: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/audit/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ checkId, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error ?? "Something went wrong.");
      location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <section className="card ring-2 ring-brand-500">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">One-time · no subscription</p>
      <h2 className="mt-1 text-xl font-bold">Get the Deep Audit for {businessName}</h2>
      <p className="mt-1 text-sm text-slate-600">
        The free check tests 8 questions. The Deep Audit tests 30 and tells you exactly what to fix, in order.
      </p>
      <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
        {INCLUDES.map((t) => <li key={t} className="flex gap-2"><span className="text-green-600">✓</span>{t}</li>)}
      </ul>
      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label" htmlFor="audit-email">Email for the report</label>
          <input id="audit-email" name="email" type="email" required className="input" placeholder="you@business.com" autoComplete="email" maxLength={254} />
        </div>
        <button className="btn sm:w-auto" disabled={busy}>{busy ? "Opening payment…" : `Get Deep Audit · ₹${priceInr.toLocaleString("en-IN")}`}</button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      <p className="mt-3 text-xs text-slate-500">Secure payment by Razorpay (UPI, cards, netbanking). Ready in about 5 minutes.</p>
    </section>
  );
}
