import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui";
import { requireUser } from "@/lib/data/session";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  const { supabase, user } = await requireUser();
  const { data: membership } = await supabase.from("org_members").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (membership) redirect("/dashboard");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="card">
          <h1 className="text-xl font-semibold">Tell us about your business</h1>
          <p className="mt-1 text-sm text-stone-600">This helps the AI write replies that sound like you. Your 14-day free trial starts now.</p>
          <OnboardingForm defaultEmail={user.email ?? ""} />
        </div>
      </div>
    </main>
  );
}
