"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const CATEGORIES = ["dentist", "restaurant", "salon", "real estate agent", "gym", "doctor", "lawyer", "plumber"];
const STEPS = ["Writing realistic customer questions…", "Asking ChatGPT, Gemini and Perplexity…", "Reading the answers…", "Calculating your score…"];

export function CheckForm({ defaultCategory = "" }: { defaultCategory?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 9000);
    return () => clearInterval(t);
  }, [loading]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) ?? "");
    setError(null);
    setFields({});
    setStep(0);
    setLoading(true);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(75_000),
        body: JSON.stringify({
          businessName: g("businessName"),
          website: g("website"),
          city: g("city"),
          category: g("category"),
          competitors: ["c1", "c2", "c3"].map(g).filter((c) => c.trim()),
          hp: g("hp"),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFields(data.fields ?? {});
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      router.push(`/results/${data.id}`);
    } catch {
      setError("That took too long or the connection dropped. Please try again.");
      setLoading(false);
    }
  }

  const fe = (k: string) => fields[k] && <p className="mt-1 text-sm text-red-600">{fields[k]}</p>;

  if (loading)
    return (
      <div className="card text-center" aria-live="polite">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
        <p className="font-semibold text-slate-900">{STEPS[step]}</p>
        <p className="mt-1 text-sm text-slate-500">This takes about 30–60 seconds. Please keep this page open.</p>
      </div>
    );

  return (
    <form onSubmit={onSubmit} className="card space-y-4" noValidate>
      <div>
        <label className="label" htmlFor="businessName">Business name</label>
        <input id="businessName" name="businessName" className="input" placeholder="e.g. Smile Care Dental" required maxLength={80} autoComplete="organization" />
        {fe("businessName")}
      </div>
      <div>
        <label className="label" htmlFor="website">Website</label>
        <input id="website" name="website" className="input" placeholder="smilecare.in" required inputMode="url" autoComplete="url" maxLength={200} />
        {fe("website")}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="city">City</label>
          <input id="city" name="city" className="input" placeholder="Pune" required maxLength={60} autoComplete="address-level2" />
          {fe("city")}
        </div>
        <div>
          <label className="label" htmlFor="category">Business category</label>
          <input id="category" name="category" className="input" list="cats" placeholder="dentist" defaultValue={defaultCategory} required maxLength={50} />
          <datalist id="cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
          {fe("category")}
        </div>
      </div>
      <fieldset>
        <legend className="label">Competitors <span className="font-normal text-slate-400">(optional, up to 3)</span></legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {["c1", "c2", "c3"].map((n, i) => (
            <input key={n} name={n} className="input" placeholder={`Competitor ${i + 1}`} maxLength={80} aria-label={`Competitor ${i + 1}`} />
          ))}
        </div>
        {fe("competitors")}
      </fieldset>
      {/* honeypot: hidden from people, bots fill it */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label>Leave empty<input name="hp" tabIndex={-1} autoComplete="off" /></label>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button type="submit" className="btn w-full">Check my AI visibility: free</button>
      <p className="text-center text-xs text-slate-500">No signup needed to see your score. AI answers vary by user and location; this is an estimate.</p>
    </form>
  );
}
