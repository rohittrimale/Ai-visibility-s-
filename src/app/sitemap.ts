import type { MetadataRoute } from "next";
import { NICHES } from "@/lib/niches";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const now = new Date();
  const pages = [
    { url: `${base}/`, priority: 1 },
    ...NICHES.map((n) => ({ url: `${base}/${n.slug}`, priority: 0.8 })),
    ...(process.env.NEXT_PUBLIC_PAID_ENABLED === "1" ? [{ url: `${base}/pricing`, priority: 0.5 }] : []),
  ];
  return pages.map((p) => ({ ...p, lastModified: now, changeFrequency: "monthly" as const }));
}
