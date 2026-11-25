import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "AI Visibility Checker: Does ChatGPT recommend your business?", template: "%s | AI Visibility Checker" },
  description:
    "Free tool for local businesses: see whether ChatGPT, Gemini and Perplexity recommend you when customers ask for the best business near them.",
  openGraph: { type: "website", siteName: "AI Visibility Checker", title: "Does ChatGPT recommend your business?", description: "Free AI visibility check for local businesses." },
  alternates: { canonical: "/" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1d4ed8" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const paid = process.env.NEXT_PUBLIC_PAID_ENABLED === "1";
  return (
    <html lang="en">
      <body className="font-sans">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
            <Link href="/" className="flex items-center gap-2 font-bold text-slate-900">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-sm text-white">AI</span>
              Visibility Checker
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
              <Link href="/agencies" className="hidden hover:text-slate-900 sm:inline">For agencies</Link>
              {paid && <Link href="/pricing" className="hover:text-slate-900">Pricing</Link>}
              {paid && <Link href="/login" className="hover:text-slate-900">Log in</Link>}
              <Link href="/#check" className="rounded-lg bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700">Free check</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="mt-16 border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl space-y-3 px-4 py-8 text-sm text-slate-500">
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <Link href="/dentists" className="hover:text-slate-800">Dentists</Link>
              <Link href="/restaurants" className="hover:text-slate-800">Restaurants</Link>
              <Link href="/salons" className="hover:text-slate-800">Salons</Link>
              <Link href="/real-estate" className="hover:text-slate-800">Real estate</Link>
              <Link href="/agencies" className="hover:text-slate-800">For agencies</Link>
            </div>
            <p>AI answers vary by user and location; this is an estimate.</p>
            <p>© {new Date().getFullYear()} AI Visibility Checker</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
