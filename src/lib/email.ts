import { config } from "./config";
import { engineLabel } from "./providers";
import { promptRows, type LoadedReport } from "./report";
import { scoreLabel } from "./scoring";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function reportEmailHtml(r: LoadedReport): string {
  const { check, business } = r;
  const rep = check.report!;
  const link = `${config.siteUrl}/results/${check.id}`;
  const engines = Object.entries(check.engine_scores ?? {})
    .map(([e, v]) => `<tr><td style="padding:4px 12px 4px 0">${esc(engineLabel(e))}</td><td><b>${v.score}/100</b> (${v.mentioned}/${v.total} answers)</td></tr>`)
    .join("");
  const wins = promptRows(r.results).filter((p) => p.anyMentioned).map((p) => `<li>${esc(p.prompt)}</li>`).join("");
  const comps = rep.topCompetitors.map((c) => `<li>${esc(c.name)} (${c.count}×)</li>`).join("");
  const tips = rep.tips.map((t) => `<li style="margin-bottom:8px">${esc(t)}</li>`).join("");
  const plan = (rep.plan ?? [])
    .map((w) => `<h4 style="margin:16px 0 4px">Week ${w.week}: ${esc(w.title)}</h4><ul>${w.items.map((i) => `<li style="margin-bottom:6px">${esc(i)}</li>`).join("")}</ul>`)
    .join("");
  const isAudit = check.source === "audit";
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;max-width:560px;margin:auto;padding:16px">
<h2 style="margin-bottom:0">${isAudit ? "AI Visibility Deep Audit" : "AI Visibility Report"}: ${esc(business.name)}</h2>
<p style="color:#475569;margin-top:4px">${esc(business.category)} · ${esc(business.city)}</p>
<p style="font-size:40px;margin:8px 0"><b>${check.score}</b><span style="font-size:18px;color:#475569">/100 · ${scoreLabel(check.score ?? 0)}</span></p>
<table style="border-collapse:collapse">${engines}</table>
<h3>Questions where you were recommended</h3>${wins ? `<ul>${wins}</ul>` : "<p>None of the tested questions mentioned your business.</p>"}
<h3>Competitors that appeared instead</h3>${comps ? `<ul>${comps}</ul>` : "<p>No clear competitors detected.</p>"}
${plan ? `<h3>Your 4-week action plan</h3>${plan}` : `<h3>What to do next</h3><ol>${tips}</ol>`}
<p><a href="${esc(link)}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">View full report</a></p>
<p style="font-size:12px;color:#64748b">AI answers vary by user and location; this is an estimate.</p>
</body></html>`;
}

/** Sends via Resend. Returns false (never throws) so a mail outage can't block the unlock. */
export async function sendReportEmail(to: string, r: LoadedReport): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: config.emailFrom,
        to: [to],
        subject: r.check.source === "audit"
          ? `Your AI Visibility Deep Audit for ${r.business.name} is ready`
          : `Your AI Visibility Report for ${r.business.name}: ${r.check.score}/100`,
        html: reportEmailHtml(r),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
