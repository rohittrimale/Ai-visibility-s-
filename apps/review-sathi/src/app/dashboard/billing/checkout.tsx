"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type RazorpayResponse = { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (event: string, cb: (resp: { error?: { description?: string } }) => void) => void };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Razorpay. Check your connection."));
    document.body.appendChild(script);
  });
}

export function SubscribeButton({ plan, label }: { plan: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function subscribe() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start checkout.");
      if (data.changed) {
        setMessage({ ok: true, text: "Plan change scheduled for your next billing date." });
        router.refresh();
        return;
      }
      await loadCheckout();
      const checkout = new window.Razorpay!({
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: "ReviewSathi",
        description: `${plan === "growth" ? "Growth" : "Starter"} plan, monthly`,
        prefill: { email: data.email ?? undefined },
        notes: { business: data.name },
        theme: { color: "#047857" },
        handler: async (response: RazorpayResponse) => {
          const verify = await fetch("/api/billing/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          const result = await verify.json();
          setMessage(verify.ok ? { ok: true, text: "Thank you! Your subscription is set up." } : { ok: false, text: result.error });
          router.refresh();
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      checkout.on("payment.failed", (resp) => setMessage({ ok: false, text: resp.error?.description ?? "Payment failed." }));
      checkout.open();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" className="btn-primary w-full" onClick={subscribe} disabled={busy}>
        {busy ? "Opening checkout…" : label}
      </button>
      {message && <p className={`text-sm ${message.ok ? "text-brand-700" : "text-red-700"}`}>{message.text}</p>}
    </div>
  );
}

export function CancelButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className="btn-ghost text-red-700"
        disabled={busy}
        onClick={async () => {
          if (!window.confirm("Cancel your subscription? You keep access until the end of the period you paid for.")) return;
          setBusy(true);
          const res = await fetch("/api/billing/cancel", { method: "POST" });
          const data = await res.json();
          setMessage(res.ok ? (data.atCycleEnd ? "Cancelled. You keep access until your renewal date." : "Cancelled.") : data.error);
          setBusy(false);
          router.refresh();
        }}
      >
        Cancel subscription
      </button>
      {message && <span className="text-sm text-stone-600">{message}</span>}
    </div>
  );
}
