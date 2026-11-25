import { buildActionPlan } from "./actionPlan";
import { AUDIT_PROMPTS } from "./billing/audit";
import { sendReportEmail } from "./email";
import { generatePrompts } from "./prompts";
import type { Provider } from "./providers";
import { loadReport } from "./report";
import { runCheck } from "./runner";
import type { AuditRow, Store } from "./store/types";
import { hostOf } from "./validation";

/**
 * Runs a paid Deep Audit: 30 questions on every engine, plus a 4-week action plan, then emails it.
 * Safe to call more than once for the same audit (webhook retries, cron sweep): only the caller that
 * wins the paid→running transition does the work.
 */
export async function runAudit(store: Store, audit: AuditRow, providers: Provider[]): Promise<"done" | "failed" | "skipped"> {
  const claimed = audit.status === "running"
    ? await store.transitionAudit(audit.id, ["running"], "running") // stale run picked up by the cron sweep
    : await store.transitionAudit(audit.id, ["paid"], "running");
  if (!claimed) return "skipped";

  try {
    const source = await store.getCheck(audit.check_id);
    const business = source && (await store.getBusiness(source.business_id));
    if (!business || !providers.length) throw new Error("missing business or engines");

    const check = await store.createCheck({ business_id: business.id, source: "audit", ip_hash: null });
    await store.updateAudit(audit.id, { audit_check_id: check.id });
    const out = await runCheck({
      store, checkId: check.id, business, providers,
      prompts: generatePrompts(business, AUDIT_PROMPTS),
      deadlineMs: 230_000,
    });
    if (!out.ok) throw new Error("engines failed");

    const done = await store.getCheck(check.id);
    const results = await store.listPromptResults(check.id);
    const plan = buildActionPlan(
      results,
      { businessName: business.name, domain: hostOf(business.website), city: business.city, category: business.category },
      done?.report?.topCompetitors ?? [],
    );
    await store.updateCheck(check.id, { unlocked: true, report: { ...done!.report!, plan } });
    await store.transitionAudit(audit.id, ["running"], "done");

    const report = await loadReport(store, check.id);
    if (report) await sendReportEmail(audit.email, report);
    return "done";
  } catch (e) {
    console.error("audit failed", audit.id, e instanceof Error ? e.message : e);
    await store.transitionAudit(audit.id, ["running"], "failed");
    return "failed";
  }
}
