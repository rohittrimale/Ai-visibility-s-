"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Reviews" },
  { href: "/dashboard/posts", label: "Weekly posts" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/dashboard/billing", label: "Billing" },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto text-sm">
      {LINKS.map((link) => {
        const active = link.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`whitespace-nowrap border-b-2 px-3 py-2 ${active ? "border-brand-700 font-medium text-brand-800" : "border-transparent text-stone-600 hover:text-stone-900"}`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
