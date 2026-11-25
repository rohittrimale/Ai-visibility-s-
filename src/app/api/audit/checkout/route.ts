import { after, NextResponse } from "next/server";
import { runAudit } from "@/lib/audit";
import { auditMode, auditPriceInr, createAuditPaymentLink } from "@/lib/billing/audit";
import { clientIp, hashValue } from "@/lib/limits";
import { enabledProviders } from "@/lib/providers";
import { loadReport } from "@/lib/report";
import { getStore } from "@/lib/store";
import { unlockSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // dev mode runs the audit in after()

/** Starts a one-time Deep Audit purchase for a free check. Returns the hosted payment page URL. */
export async function POST(req: Request) {
  const mode = auditMode();
  if (mode === "off") return NextResponse.json({ error: "Not available." }, { status: 404 });

  const raw = await req.text();
  if (raw.length > 2000) return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = unlockSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  const { checkId, email } = parsed.data;

  const store = getStore();
  const report = await loadReport(store, checkId);
  if (!report || report.check.source === "audit") return NextResponse.json({ error: "Report not found." }, { status: 404 });

  // Each attempt creates a payment link; cap them so the endpoint can't be used to spam Razorpay.
  if (!(await store.hitRateLimit(`audit:${hashValue("ip", clientIp(req.headers))}`, 10)))
    return NextResponse.json({ error: "Too many attempts today. Please try again tomorrow." }, { status: 429 });

  const amountInr = auditPriceInr();
  const audit = await store.createAudit({ check_id: checkId, email, amount_inr: amountInr });

  if (mode === "dev") {
    // No Razorpay keys (local only): simulate a successful payment so the whole flow can be tried.
    await store.transitionAudit(audit.id, ["pending"], "paid");
    const paid = (await store.getAudit(audit.id))!;
    after(() => runAudit(store, paid, enabledProviders()).then(() => undefined));
    return NextResponse.json({ url: `/results/${checkId}?audit=${audit.id}` });
  }

  try {
    const link = await createAuditPaymentLink({ auditId: audit.id, checkId, email, businessName: report.business.name, amountInr });
    await store.updateAudit(audit.id, { payment_link_id: link.paymentLinkId });
    return NextResponse.json({ url: link.url });
  } catch (e) {
    console.error("audit checkout failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }
}
