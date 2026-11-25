export type Email = { subject: string; html: string; text: string };

function esc(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stars(n: number): string {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function layout(title: string, body: string, cta: { label: string; url: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:24px">
<tr><td>
<p style="margin:0 0 4px;font-size:13px;color:#57534e">ReviewSathi</p>
<h1 style="margin:0 0 16px;font-size:20px">${esc(title)}</h1>
${body}
<p style="margin:24px 0 0"><a href="${esc(cta.url)}" style="background:#047857;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block">${esc(cta.label)}</a></p>
</td></tr></table>
<p style="font-size:12px;color:#78716c;margin-top:12px">You get these emails because you use ReviewSathi. Change alerts in Settings.</p>
</td></tr></table></body></html>`;
}

export type AlertReview = {
  locationTitle: string;
  reviewerName: string | null;
  starRating: number;
  comment: string | null;
  draftReply: string | null;
};

export function negativeReviewAlert(review: AlertReview, dashboardUrl: string): Email {
  const who = review.reviewerName ?? "A customer";
  const subject = `${review.starRating}★ review for ${review.locationTitle}: please reply soon`;
  const body = `
<p style="margin:0 0 8px;font-size:15px"><strong>${esc(who)}</strong> left <span style="color:#b45309">${stars(review.starRating)}</span></p>
<blockquote style="margin:0 0 16px;padding:12px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:4px">${esc(review.comment) || "<em>No text, rating only.</em>"}</blockquote>
${review.draftReply ? `<p style="margin:0 0 4px;font-size:13px;color:#57534e">Suggested reply (not posted yet):</p><p style="margin:0;padding:12px;background:#f0fdf4;border-radius:4px">${esc(review.draftReply)}</p>` : ""}
<p style="margin:16px 0 0;font-size:14px">A quick, kind reply shows future customers you care. Review it, edit if needed, and post it in one tap.</p>`;
  const text = `${who} left a ${review.starRating}-star review for ${review.locationTitle}.\n\n"${review.comment ?? "(no text)"}"\n\n${review.draftReply ? `Suggested reply: ${review.draftReply}\n\n` : ""}Reply here: ${dashboardUrl}`;
  return { subject, html: layout("A customer needs your attention", body, { label: "Review and reply", url: dashboardUrl }), text };
}

export function newReviewsDigest(opts: { businessName: string; count: number; pending: number; dashboardUrl: string }): Email {
  const subject = `${opts.count} new review${opts.count === 1 ? "" : "s"} for ${opts.businessName}`;
  const body = `<p style="margin:0;font-size:15px">You got <strong>${opts.count}</strong> new review${opts.count === 1 ? "" : "s"}. <strong>${opts.pending}</strong> ${opts.pending === 1 ? "reply is" : "replies are"} drafted and waiting for your approval.</p>`;
  const text = `${subject}. ${opts.pending} drafted replies are waiting for approval: ${opts.dashboardUrl}`;
  return { subject, html: layout(subject, body, { label: "Approve replies", url: opts.dashboardUrl }), text };
}

export function weeklyPostReady(opts: { businessName: string; draft: string; postsUrl: string }): Email {
  const subject = `This week's Google post for ${opts.businessName} is ready`;
  const body = `<p style="margin:0 0 8px;font-size:15px">Posting every week helps you show up higher on Google Maps. Here's a draft:</p>
<p style="margin:0;padding:12px;background:#f5f5f4;border-radius:4px;white-space:pre-wrap">${esc(opts.draft)}</p>`;
  const text = `${subject}\n\n${opts.draft}\n\nEdit and post: ${opts.postsUrl}`;
  return { subject, html: layout("Your weekly post is ready", body, { label: "Edit and post", url: opts.postsUrl }), text };
}

export function trialEndingSoon(opts: { businessName: string; daysLeft: number; billingUrl: string }): Email {
  const subject = `Your ReviewSathi trial ends in ${opts.daysLeft} day${opts.daysLeft === 1 ? "" : "s"}`;
  const body = `<p style="margin:0;font-size:15px">Keep AI replies and bad-review alerts running for ${esc(opts.businessName)}. Pay monthly with UPI, cancel any time.</p>`;
  const text = `${subject}. Subscribe here: ${opts.billingUrl}`;
  return { subject, html: layout(subject, body, { label: "Choose a plan", url: opts.billingUrl }), text };
}
