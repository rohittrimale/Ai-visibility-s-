"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isBusinessType } from "@/lib/business-types";
import { requireUser } from "@/lib/data/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

const schema = z.object({
  name: z.string().trim().min(1, "Enter your business name").max(120),
  businessType: z.string().refine(isBusinessType, "Choose a business type"),
  city: z.string().trim().max(60).optional(),
  alertEmail: z.union([z.literal(""), z.email("Enter a valid email")]).optional(),
});

export type OnboardingState = { error: string | null };

export async function createBusiness(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const { user } = await requireUser();
  const parsed = schema.safeParse({
    name: formData.get("name"),
    businessType: formData.get("businessType"),
    city: formData.get("city") ?? undefined,
    alertEmail: formData.get("alertEmail") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form" };

  const db = supabaseAdmin();
  const { data: existing } = await db.from("org_members").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (existing) redirect("/dashboard");

  const { data: org, error } = await db
    .from("orgs")
    .insert({
      name: parsed.data.name,
      business_type: parsed.data.businessType,
      city: parsed.data.city || null,
      alert_email: parsed.data.alertEmail || user.email || null,
    })
    .select("id")
    .single();
  if (error || !org) return { error: "Could not create your business. Please try again." };

  const { error: memberError } = await db.from("org_members").insert({ org_id: org.id, user_id: user.id, role: "owner" });
  if (memberError) {
    await db.from("orgs").delete().eq("id", org.id);
    return { error: "Could not create your business. Please try again." };
  }

  redirect("/dashboard/settings?welcome=1");
}
