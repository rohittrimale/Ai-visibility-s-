"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { maxLocationsFor, PLANS, isPlanId } from "@/lib/billing/plans";
import { isBusinessType } from "@/lib/business-types";
import { requireOrg } from "@/lib/data/session";
import { gbpClientForOrg } from "@/lib/google/connection";
import { importLocations } from "@/lib/google/import";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type FormState = { ok: boolean; message: string | null };

const businessSchema = z.object({
  name: z.string().trim().min(1, "Enter your business name").max(120),
  businessType: z.string().refine(isBusinessType, "Choose a business type"),
  city: z.string().trim().max(60),
  alertEmail: z.union([z.literal(""), z.email("Enter a valid alert email")]),
  negativeThreshold: z.coerce.number().int().min(1).max(4),
  weeklyDigest: z.boolean(),
});

export async function updateBusiness(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { ok: false, message: "Only the owner can change settings." };
  const parsed = businessSchema.safeParse({
    name: formData.get("name"),
    businessType: formData.get("businessType"),
    city: formData.get("city") ?? "",
    alertEmail: formData.get("alertEmail") ?? "",
    negativeThreshold: formData.get("negativeThreshold"),
    weeklyDigest: formData.get("weeklyDigest") === "on",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the form." };
  const { error } = await ctx.supabase
    .from("orgs")
    .update({
      name: parsed.data.name,
      business_type: parsed.data.businessType,
      city: parsed.data.city || null,
      alert_email: parsed.data.alertEmail || null,
      negative_threshold: parsed.data.negativeThreshold,
      weekly_digest: parsed.data.weeklyDigest,
    })
    .eq("id", ctx.org.id);
  if (error) return { ok: false, message: "Could not save. Please try again." };
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Saved." };
}

const locationSchema = z.object({
  id: z.uuid(),
  enabled: z.boolean(),
  replyMode: z.enum(["manual", "auto_positive", "auto_all"]),
  replyLanguage: z.enum(["auto", "en", "hi", "hinglish", "mr"]),
  tone: z.enum(["warm", "professional", "friendly"]),
  signature: z.string().trim().max(80),
  extraInstructions: z.string().trim().max(1000),
});

export async function updateLocation(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { ok: false, message: "Only the owner can change settings." };
  const parsed = locationSchema.safeParse({
    id: formData.get("id"),
    enabled: formData.get("enabled") === "on",
    replyMode: formData.get("replyMode"),
    replyLanguage: formData.get("replyLanguage"),
    tone: formData.get("tone"),
    signature: formData.get("signature") ?? "",
    extraInstructions: formData.get("extraInstructions") ?? "",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the form." };

  const onTrial = ctx.access.allowed && ctx.access.reason === "trial";
  const plan = ctx.subscription?.plan ?? ctx.org.plan;
  if (parsed.data.replyMode === "auto_all" && !onTrial && !(isPlanId(plan) && PLANS[plan].allowAutoAll)) {
    return { ok: false, message: "Auto-reply to all reviews is part of the Growth plan." };
  }
  if (parsed.data.enabled) {
    const { count } = await ctx.supabase
      .from("locations")
      .select("id", { count: "exact", head: true })
      .eq("org_id", ctx.org.id)
      .eq("enabled", true)
      .neq("id", parsed.data.id);
    const limit = maxLocationsFor(plan, onTrial);
    if ((count ?? 0) >= limit) {
      return { ok: false, message: `Your plan covers ${limit} location${limit === 1 ? "" : "s"}. Upgrade in Billing to add more.` };
    }
  }

  const { error } = await ctx.supabase
    .from("locations")
    .update({
      enabled: parsed.data.enabled,
      reply_mode: parsed.data.replyMode,
      reply_language: parsed.data.replyLanguage,
      tone: parsed.data.tone,
      signature: parsed.data.signature || null,
      extra_instructions: parsed.data.extraInstructions || null,
    })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, message: "Could not save. Please try again." };
  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Saved." };
}

export async function refreshLocations(): Promise<FormState> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { ok: false, message: "Only the owner can do this." };
  try {
    const found = await importLocations(ctx.org.id, await gbpClientForOrg(ctx.org.id));
    revalidatePath("/dashboard/settings");
    return { ok: true, message: `Found ${found} location${found === 1 ? "" : "s"} on Google.` };
  } catch {
    return { ok: false, message: "Could not load locations from Google. Try reconnecting." };
  }
}

export async function disconnectGoogle(): Promise<FormState> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { ok: false, message: "Only the owner can do this." };
  const db = supabaseAdmin();
  const { data: connection } = await db
    .from("google_connections")
    .select("encrypted_refresh_token, is_demo")
    .eq("org_id", ctx.org.id)
    .maybeSingle();
  if (connection && !connection.is_demo) {
    // Best effort: revoke the token at Google too.
    try {
      const { decryptSecret } = await import("@/lib/crypto");
      const { env } = await import("@/lib/env");
      const token = decryptSecret(connection.encrypted_refresh_token, env.tokenEncryptionKey());
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
      });
    } catch {
      // ignore
    }
  }
  await db.from("google_connections").delete().eq("org_id", ctx.org.id);
  await db.from("orgs").update({ google_account_email: null, google_connected_at: null }).eq("id", ctx.org.id);
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Google disconnected." };
}
