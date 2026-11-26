import type { Metadata } from "next";
import { inr } from "@/components/ui";
import { PLANS } from "@/lib/billing/plans";
import { requireOrg } from "@/lib/data/session";
import { CancelButton, SubscribeButton } from "./checkout";

export const metadata: Metadata = { title: "Billing" };

const STATUS_TEXT: Record<string, string> = {
  created: "Checkout not finished",
  authenticated: "UPI AutoPay set up. First charge when your trial ends.",
  active: "Active",
  pending: "Payment failed. Razorpay is retrying.",
  halted: "Paused after failed payments",
  cancelled: "Cancelled",
  completed: "Completed",
  paused: "Paused",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export default async function BillingPage() {
  const ctx = await requireOrg();
  const sub = ctx.subscription;
  const live = sub && ["active", "authenticated", "pending"].includes(sub.status);
  const currentPlan = live ? sub.plan : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Billing</h1>

      <div className="card space-y-1">
        <p className="text-sm text-stone-500">Current status</p>
        {ctx.access.allowed && ctx.access.reason === "trial" && !live ? (
          <p className="font-medium">
            Free trial: {ctx.access.daysLeft} day{ctx.access.daysLeft === 1 ? "" : "s"} left (ends {formatDate(ctx.org.trial_ends_at)})
          </p>
        ) : sub ? (
          <p className="font-medium">
            {PLANS[sub.plan as keyof typeof PLANS]?.name ?? sub.plan} plan · {STATUS_TEXT[sub.status] ?? sub.status}
            {sub.current_period_end && sub.status === "active" && ` · renews ${formatDate(sub.current_period_end)}`}
            {sub.current_period_end && sub.status === "cancelled" && ` · access until ${formatDate(sub.current_period_end)}`}
          </p>
        ) : (
          <p className="font-medium">No active plan</p>
        )}
        {live && ctx.role === "owner" && (
          <div className="pt-3">
            <CancelButton />
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {Object.values(PLANS).map((plan) => (
          <div key={plan.id} className={`card flex flex-col ${currentPlan === plan.id ? "border-brand-600 ring-2 ring-brand-100" : ""}`}>
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold">{plan.name}</p>
              {currentPlan === plan.id && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-800">Your plan</span>}
            </div>
            <p className="mt-2">
              <span className="text-3xl font-bold">{inr(plan.priceInr)}</span>
              <span className="text-stone-500"> / month + GST</span>
            </p>
            <ul className="mt-4 flex-1 space-y-2 text-sm text-stone-700">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <span className="text-brand-700">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            {ctx.role === "owner" && currentPlan !== plan.id && (
              <div className="mt-6">
                <SubscribeButton plan={plan.id} label={live ? `Switch to ${plan.name}` : `Choose ${plan.name}`} />
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-sm text-stone-500">
        Payments are handled by Razorpay. Pay with UPI AutoPay, debit or credit card. If you subscribe during your trial, your first charge
        happens when the trial ends. Cancel any time and keep access until the end of the month you paid for.
      </p>
    </div>
  );
}
