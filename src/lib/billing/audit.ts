import { config } from "../config";

/** One-time Deep Audit: the product a free-check visitor can buy without an account. */
export const AUDIT_PROMPTS = 30;

export const auditPriceInr = () => {
  const n = Number(process.env.AUDIT_PRICE_INR);
  return Number.isInteger(n) && n > 0 ? n : 999;
};

const razorpayReady = () => !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;

/**
 * "live": real Razorpay checkout. "dev": no Razorpay keys outside production, so checkout is
 * simulated (marked paid immediately) to let you try the whole flow locally. "off": not offered.
 */
export function auditMode(): "live" | "dev" | "off" {
  if (["0", "false", "off", "no"].includes((process.env.AUDIT_ENABLED ?? "").toLowerCase())) return "off";
  if (razorpayReady()) return "live";
  return process.env.NODE_ENV === "production" ? "off" : "dev";
}

const auth = () =>
  "Basic " + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");

/** Creates a Razorpay Payment Link (hosted page: UPI, cards, netbanking). No login needed. */
export async function createAuditPaymentLink(a: { auditId: string; checkId: string; email: string; businessName: string; amountInr: number }) {
  const res = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: { authorization: auth(), "content-type": "application/json" },
    body: JSON.stringify({
      amount: a.amountInr * 100, // paise
      currency: "INR",
      accept_partial: false,
      reference_id: a.auditId,
      description: `AI Visibility Deep Audit: ${a.businessName}`.slice(0, 2048),
      customer: { email: a.email },
      notify: { email: true, sms: false },
      reminder_enable: false,
      notes: { kind: "audit", audit_id: a.auditId, check_id: a.checkId },
      callback_url: `${config.siteUrl}/results/${a.checkId}?audit=${a.auditId}`,
      callback_method: "get",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Razorpay returned ${res.status}`);
  const j = (await res.json()) as { id: string; short_url: string };
  return { paymentLinkId: j.id, url: j.short_url };
}

type PaymentLinkEvent = {
  event?: string;
  payload?: { payment_link?: { entity?: { id?: string; status?: string; amount_paid?: number; notes?: { kind?: string; audit_id?: string } } } };
};

/** Extracts a paid audit from a (signature-verified) Razorpay webhook body, or null if it isn't one. */
export function paidAuditFromEvent(evt: PaymentLinkEvent): { auditId: string; paymentLinkId: string; amountPaidInr: number } | null {
  if (evt.event !== "payment_link.paid") return null;
  const pl = evt.payload?.payment_link?.entity;
  if (!pl?.id || pl.notes?.kind !== "audit" || !pl.notes.audit_id) return null;
  return { auditId: pl.notes.audit_id, paymentLinkId: pl.id, amountPaidInr: Math.floor((pl.amount_paid ?? 0) / 100) };
}
