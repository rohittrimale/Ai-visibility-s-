import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Landing } from "@/components/Landing";
import { NICHES, nicheBySlug } from "@/lib/niches";

export const dynamicParams = false;
export const generateStaticParams = () => NICHES.map((n) => ({ niche: n.slug }));

export async function generateMetadata({ params }: { params: Promise<{ niche: string }> }): Promise<Metadata> {
  const n = nicheBySlug((await params).niche);
  if (!n) return {};
  return {
    title: { absolute: n.title },
    description: n.description,
    alternates: { canonical: `/${n.slug}` },
    openGraph: { title: n.title, description: n.description, url: `/${n.slug}` },
  };
}

export default async function NichePage({ params }: { params: Promise<{ niche: string }> }) {
  const n = nicheBySlug((await params).niche);
  if (!n) notFound();
  return <Landing niche={n} />;
}
