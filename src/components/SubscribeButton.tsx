"use client";
import { useState } from "react";

export function SubscribeButton({ plan }: { plan: "starter" | "growth" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    setBusy(true); setError(null);
    const res = await fetch("/api/billing/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan }) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) return void (location.href = "/login");
    if (!res.ok) { setError(data.error ?? "Failed"); return setBusy(false); }
    location.href = data.url;
  }
  return (
    <div>
      <button onClick={go} disabled={busy} className="btn w-full">{busy ? "Redirecting…" : "Choose plan"}</button>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
