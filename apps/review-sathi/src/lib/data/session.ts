import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { accessState, type AccessState } from "@/lib/billing/plans";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OrgContext = {
  userId: string;
  email: string | null;
  role: "owner" | "staff";
  org: {
    id: string;
    name: string;
    business_type: string;
    city: string | null;
    alert_email: string | null;
    negative_threshold: number;
    weekly_digest: boolean;
    plan: string;
    trial_ends_at: string;
    google_account_email: string | null;
    google_connected_at: string | null;
  };
  subscription: { plan: string; status: string; current_period_end: string | null; razorpay_subscription_id: string | null } | null;
  access: AccessState;
};

/** The signed-in user, or a redirect to /login. */
export const requireUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
});

/** The signed-in user's business. Sends users without one to onboarding. */
export const requireOrg = cache(async (): Promise<OrgContext & { supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> }> => {
  const { supabase, user } = await requireUser();
  const { data: membership } = await supabase
    .from("org_members")
    .select("role, orgs(id, name, business_type, city, alert_email, negative_threshold, weekly_digest, plan, trial_ends_at, google_account_email, google_connected_at)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const org = membership?.orgs as unknown as OrgContext["org"] | null;
  if (!membership || !org) redirect("/onboarding");

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end, razorpay_subscription_id")
    .eq("org_id", org.id)
    .maybeSingle();

  return {
    supabase,
    userId: user.id,
    email: user.email ?? null,
    role: membership.role as "owner" | "staff",
    org,
    subscription: subscription ?? null,
    access: accessState({
      trialEndsAt: org.trial_ends_at,
      subscription: subscription ? { status: subscription.status, currentPeriodEnd: subscription.current_period_end } : null,
    }),
  };
});
