import Link from "next/link";
import { Logo, Notice } from "@/components/ui";
import { requireOrg } from "@/lib/data/session";
import { NavLinks } from "./nav-links";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const ctx = await requireOrg();
  const { access } = ctx;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo href="/dashboard" />
            <span className="hidden text-sm text-stone-500 sm:inline">· {ctx.org.name}</span>
          </div>
          <form action="/auth/signout" method="post">
            <button className="btn-ghost text-sm" type="submit">
              Sign out
            </button>
          </form>
        </div>
        <div className="mx-auto max-w-5xl px-4">
          <NavLinks />
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {access.allowed && access.reason === "trial" && access.daysLeft <= 5 && (
          <div className="mb-4">
            <Notice tone="warn">
              Your free trial ends in {access.daysLeft} day{access.daysLeft === 1 ? "" : "s"}.{" "}
              <Link href="/dashboard/billing" className="font-medium underline">
                Choose a plan
              </Link>{" "}
              to keep replies and alerts running.
            </Notice>
          </div>
        )}
        {access.allowed && access.reason === "grace" && (
          <div className="mb-4">
            <Notice tone="warn">
              Your last payment did not go through. Razorpay will retry automatically. Please check your UPI or card in{" "}
              <Link href="/dashboard/billing" className="font-medium underline">
                Billing
              </Link>
              .
            </Notice>
          </div>
        )}
        {!access.allowed && (
          <div className="mb-4">
            <Notice tone="error">
              {access.reason === "payment_failed"
                ? "Your subscription is paused because payments failed."
                : access.reason === "cancelled"
                  ? "Your subscription has ended."
                  : "Your free trial has ended."}{" "}
              Reviews are no longer synced or replied to.{" "}
              <Link href="/dashboard/billing" className="font-medium underline">
                Choose a plan
              </Link>{" "}
              to turn them back on.
            </Notice>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
