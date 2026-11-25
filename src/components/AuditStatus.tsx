import Link from "next/link";
import type { AuditRow } from "@/lib/store/types";

/** Shown on the free results page after the buyer returns from the payment page. */
export function AuditStatus({ audit }: { audit: AuditRow }) {
  if (audit.status === "done" && audit.audit_check_id)
    return (
      <section className="card border-green-200 bg-green-50">
        <h2 className="text-lg font-bold text-green-900">Your Deep Audit is ready</h2>
        <p className="mt-1 text-sm text-green-900">We've also emailed it to {audit.email}.</p>
        <Link href={`/results/${audit.audit_check_id}`} className="btn mt-3">Open the Deep Audit</Link>
      </section>
    );
  if (audit.status === "failed")
    return (
      <section className="card border-amber-200 bg-amber-50">
        <h2 className="text-lg font-bold text-amber-900">We couldn't finish your Deep Audit</h2>
        <p className="mt-1 text-sm text-amber-900">The AI engines didn't respond. Reply to your payment receipt email and we'll re-run it or refund you in full.</p>
      </section>
    );
  return (
    <section className="card border-brand-100 bg-brand-50" aria-live="polite">
      <meta httpEquiv="refresh" content="15" />
      <h2 className="text-lg font-bold">
        {audit.status === "pending" ? "Confirming your payment…" : "Payment received. Running your Deep Audit…"}
      </h2>
      <p className="mt-1 text-sm text-slate-700">
        This takes about 5 minutes. This page refreshes on its own, and we'll email the report to {audit.email}.
      </p>
    </section>
  );
}
