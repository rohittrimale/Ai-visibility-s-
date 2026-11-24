import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubscribeButton } from "@/components/SubscribeButton";
import { PLANS } from "@/lib/billing/plans";
import { config } from "@/lib/config";

export const metadata: Metadata = { title: "Pricing", description: "Track your AI visibility every week. Free, Starter and Growth plans." };

export default function Pricing() {
  if (!config.paidEnabled) notFound();
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">Track your AI visibility every week</h1>
      <p className="mt-2 text-slate-600">Cancel any time. Prices in INR, billed monthly.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {Object.values(PLANS).map((p) => (
          <div key={p.id} className={`card flex flex-col ${p.id === "starter" ? "ring-2 ring-brand-500" : ""}`}>
            <h2 className="text-lg font-bold">{p.name}</h2>
            <p className="mt-2 text-3xl font-extrabold">{p.priceInr ? `₹${p.priceInr.toLocaleString("en-IN")}` : "₹0"}<span className="text-base font-medium text-slate-500">/mo</span></p>
            <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
              {p.features.map((f) => <li key={f}>✓ {f}</li>)}
            </ul>
            <div className="mt-5">
              {p.id === "free" ? <Link href="/#check" className="btn-ghost w-full">Run a free check</Link> : <SubscribeButton plan={p.id} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
