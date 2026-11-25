import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-semibold text-stone-900">
      <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-brand-700 text-base text-white">
        ★
      </span>
      ReviewSathi
    </Link>
  );
}

export function Stars({ rating, size = "text-base" }: { rating: number; size?: string }) {
  return (
    <span className={`${size} tracking-tight`} aria-label={`${rating} out of 5 stars`}>
      <span className="text-amber-500">{"★".repeat(rating)}</span>
      <span className="text-stone-300">{"★".repeat(Math.max(0, 5 - rating))}</span>
    </span>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "success"; children: React.ReactNode }) {
  const styles = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  }[tone];
  return <div className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

export function inr(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - Date.parse(iso));
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
