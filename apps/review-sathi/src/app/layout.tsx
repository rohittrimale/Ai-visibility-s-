import type { Metadata } from "next";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "ReviewSathi: AI replies to your Google reviews",
    template: "%s · ReviewSathi",
  },
  description:
    "ReviewSathi replies to your Google reviews in English, Hindi and Marathi, alerts you to bad reviews instantly, and writes your weekly Google posts. Built for Indian shops, restaurants, salons and clinics.",
  openGraph: {
    title: "ReviewSathi: AI replies to your Google reviews",
    description: "Reply to every Google review in seconds, in your customer's language. 14-day free trial.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
