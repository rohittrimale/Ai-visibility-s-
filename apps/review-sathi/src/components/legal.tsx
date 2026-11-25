import Link from "next/link";
import { Logo } from "./ui";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-3xl px-4 py-4">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-stone-500">Last updated {updated}</p>
        <div className="mt-6 space-y-4 text-stone-700 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-stone-900 [&_li]:ml-5 [&_li]:list-disc">
          {children}
        </div>
        <p className="mt-10 text-sm">
          <Link href="/" className="text-brand-700 underline">
            Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
