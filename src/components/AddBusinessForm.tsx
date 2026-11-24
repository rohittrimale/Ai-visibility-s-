"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AddBusinessForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError(null);
    const res = await fetch("/api/businesses", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ businessName: f.get("businessName"), website: f.get("website"), city: f.get("city"), category: f.get("category"), competitors: [] }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Could not save.");
    router.refresh();
  }
  return (
    <form onSubmit={onSubmit} className="card grid gap-3 sm:grid-cols-2">
      <input name="businessName" className="input" placeholder="Business name" required />
      <input name="website" className="input" placeholder="Website" required />
      <input name="city" className="input" placeholder="City" required />
      <input name="category" className="input" placeholder="Category" required />
      {error && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <button className="btn sm:col-span-2" disabled={busy}>{busy ? "Saving…" : "Track this business weekly"}</button>
    </form>
  );
}
