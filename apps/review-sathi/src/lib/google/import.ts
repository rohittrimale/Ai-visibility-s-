import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { GbpClient } from "./gbp";

/** Copies the org's Google locations into our table without touching their settings. Returns how many were found. */
export async function importLocations(orgId: string, gbp: GbpClient): Promise<number> {
  const locations = await gbp.listLocations();
  if (locations.length === 0) return 0;
  const db = supabaseAdmin();
  const { data: existing } = await db.from("locations").select("google_location_name").eq("org_id", orgId);
  const known = new Set((existing ?? []).map((row: { google_location_name: string }) => row.google_location_name));

  for (const location of locations) {
    if (known.has(location.name)) {
      await db
        .from("locations")
        .update({
          title: location.title,
          address: location.address,
          google_account_name: location.accountName,
          place_id: location.placeId,
          google_review_url: location.reviewUrl,
        })
        .eq("org_id", orgId)
        .eq("google_location_name", location.name);
    } else {
      await db.from("locations").insert({
        org_id: orgId,
        google_location_name: location.name,
        google_account_name: location.accountName,
        title: location.title,
        address: location.address,
        place_id: location.placeId,
        google_review_url: location.reviewUrl,
        // Turn on the first location automatically; owners pick others in Settings.
        enabled: known.size === 0,
      });
      known.add(location.name);
    }
  }
  return locations.length;
}
