import { NextResponse } from "next/server";
import { allowEmail } from "@/lib/limits";
import { sendReportEmail } from "@/lib/email";
import { loadReport } from "@/lib/report";
import { getStore } from "@/lib/store";
import { unlockSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 2000) return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = unlockSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  const { checkId, email } = parsed.data;

  const store = getStore();
  const report = await loadReport(store, checkId);
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

  if (!(await allowEmail(store, email)))
    return NextResponse.json({ error: "This email has reached today's limit. Try again tomorrow." }, { status: 429 });

  await store.upsertLead({ email, business_id: report.business.id, check_id: checkId });
  await store.updateCheck(checkId, { unlocked: true });
  const emailed = await sendReportEmail(email, { ...report, check: { ...report.check, unlocked: true } });
  return NextResponse.json({ ok: true, emailed });
}
