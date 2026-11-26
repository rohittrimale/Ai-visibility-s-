import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Short review link used in QR codes and WhatsApp messages: counts the click, then opens Google. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/r/[code]">) {
  const { code } = await ctx.params;
  if (!/^[a-f0-9]{6,32}$/.test(code)) return notReady(404);

  const { data: target, error } = await supabaseAdmin().rpc("track_review_link", { code });
  if (error) {
    console.error("[review link]", error.message);
    return notReady(500);
  }
  if (typeof target !== "string" || !target.startsWith("https://")) return notReady(404);
  return NextResponse.redirect(target, { status: 302, headers: { "Cache-Control": "no-store" } });
}

function notReady(status: number) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Review link</title></head>
<body style="font-family:system-ui,sans-serif;max-width:420px;margin:15vh auto;padding:0 16px;text-align:center;color:#1c1917">
<h1 style="font-size:20px">This review link isn't ready yet</h1>
<p style="color:#57534e">Please search for the business on Google Maps and tap "Write a review". Thank you!</p>
</body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
