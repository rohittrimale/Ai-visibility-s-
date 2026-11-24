import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AddBusinessForm } from "@/components/AddBusinessForm";
import { TrendChart } from "@/components/TrendChart";
import { PLANS, isPlanId } from "@/lib/billing/plans";
import { config } from "@/lib/config";
import { createUserClient, supabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default async function Dashboard() {
  if (!config.paidEnabled || !supabaseConfigured()) notFound();
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("plan").eq("id", user.id).maybeSingle();
  const plan = PLANS[isPlanId(profile?.plan) ? profile!.plan : "free"];
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, city, category, checks(id, score, created_at, status)")
    .eq("user_id", user.id)
    .order("created_at");

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-extrabold">Dashboard</h1>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">{plan.name} plan</span>
      </div>
      {plan.maxBusinesses === 0 && (
        <div className="card">
          <p className="text-slate-700">Upgrade to track your visibility every week and see trends.</p>
          <Link href="/pricing" className="btn mt-3">See plans</Link>
        </div>
      )}
      {(businesses ?? []).map((b) => {
        const pts = ((b.checks as { score: number | null; created_at: string; status: string }[]) ?? [])
          .filter((c) => c.status === "done" && c.score !== null)
          .sort((x, y) => x.created_at.localeCompare(y.created_at))
          .map((c) => ({ date: c.created_at.slice(0, 10), score: c.score as number }));
        return (
          <section key={b.id} className="card">
            <h2 className="font-bold">{b.name} <span className="font-normal text-slate-500">· {b.category}, {b.city}</span></h2>
            <div className="mt-3"><TrendChart points={pts} /></div>
            {pts.length === 0 && <p className="mt-2 text-sm text-slate-500">The first weekly check will appear here after the next scheduled run.</p>}
          </section>
        );
      })}
      {plan.maxBusinesses > 0 && (businesses?.length ?? 0) < plan.maxBusinesses && <AddBusinessForm />}
    </div>
  );
}
