"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function UnlockForm({ checkId }: { checkId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ checkId, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="label" htmlFor="email">Your email</label>
      <input id="email" name="email" type="email" required className="input" placeholder="you@business.com" autoComplete="email" maxLength={254} />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button className="btn w-full" disabled={busy}>{busy ? "Unlocking…" : "Unlock full report & email it to me"}</button>
      <p className="text-xs text-slate-500">We'll email your report. No spam; unsubscribe any time.</p>
    </form>
  );
}
