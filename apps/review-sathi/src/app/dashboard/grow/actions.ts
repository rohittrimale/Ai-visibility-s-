"use server";

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/data/session";
import { validateCustomReviewUrl } from "@/lib/reviews/requests";

export type LinkState = { ok: boolean; message: string | null };

export async function saveReviewLink(_prev: LinkState, formData: FormData): Promise<LinkState> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { ok: false, message: "Only the owner can change the review link." };
  const id = String(formData.get("id") ?? "");
  const checked = validateCustomReviewUrl(String(formData.get("url") ?? ""));
  if (!checked.ok) return { ok: false, message: checked.error };
  const { error } = await ctx.supabase.from("locations").update({ custom_review_url: checked.url }).eq("id", id);
  if (error) return { ok: false, message: "Could not save the link." };
  revalidatePath("/dashboard/grow");
  return { ok: true, message: checked.url ? "Saved. Your QR code and messages now use this link." : "Saved. Using Google's link." };
}
