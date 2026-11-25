import { after, NextResponse } from "next/server";
import { PLANS, isPlanId } from "@/lib/billing/plans";
import { config } from "@/lib/config";
import { generatePrompts } from "@/lib/prompts";
import { enabledProviders } from "@/lib/providers";
import { runCheck } from "@/lib/runner";
import { getStore } from "@/lib/store";
import { createUserClient, supabaseConfigured } from "@/lib/supabase/server";
import { checkInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // first check runs in after()

/** Paid: save a business (and its prompts) for weekly tracking. Runs as the user, so RLS applies. */
export async function POST(req: Request) {
  if (!config.paidEnabled || !supabaseConfigured()) return NextResponse.json({ error: "Not available." }, { status: 404 });
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const raw = await req.text();
  if (raw.length > 4000) return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = checkInputSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  const input = parsed.data;

  const { data: profile } = await supabase.from("users").select("plan").eq("id", user.id).maybeSingle();
  const plan = PLANS[isPlanId(profile?.plan) ? profile!.plan : "free"];
  const { count } = await supabase.from("businesses").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if (plan.maxBusinesses === 0) return NextResponse.json({ error: "Upgrade your plan to track businesses." }, { status: 403 });
  if ((count ?? 0) >= plan.maxBusinesses) return NextResponse.json({ error: `Your ${plan.name} plan allows ${plan.maxBusinesses} business(es).` }, { status: 403 });

  const { data: biz, error } = await supabase
    .from("businesses")
    .insert({ user_id: user.id, name: input.businessName, website: input.website, city: input.city, category: input.category, competitors: input.competitors, tracked: true })
    .select("id").single();
  if (error || !biz) return NextResponse.json({ error: "Could not save business." }, { status: 500 });

  const prompts = generatePrompts({ category: input.category, city: input.city }, plan.maxPrompts);
  await supabase.from("business_prompts").insert(prompts.map((prompt) => ({ business_id: biz.id, prompt })));

  // Run the first check now so a new subscriber sees a score today, not after the next weekly cron.
  after(async () => {
    const store = getStore();
    const business = await store.getBusiness(biz.id);
    if (!business) return;
    const check = await store.createCheck({ business_id: business.id, source: "manual", ip_hash: null });
    await runCheck({ store, checkId: check.id, business, prompts, providers: enabledProviders(), deadlineMs: 100_000 });
  });
  return NextResponse.json({ id: biz.id, prompts: prompts.length });
}
