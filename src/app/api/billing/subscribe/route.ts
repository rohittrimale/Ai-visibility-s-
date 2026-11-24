import { NextResponse } from "next/server";
import { z } from "zod";
import { createSubscription } from "@/lib/billing/razorpay";
import { config } from "@/lib/config";
import { createUserClient, supabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!config.paidEnabled || !supabaseConfigured()) return NextResponse.json({ error: "Not available." }, { status: 404 });
  const body = z.object({ plan: z.enum(["starter", "growth"]) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid plan." }, { status: 400 });

  const { data: { user } } = await (await createUserClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  try {
    const { url } = await createSubscription(body.data.plan, user.id);
    return NextResponse.json({ url });
  } catch (e) {
    console.error("subscribe failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
  }
}
