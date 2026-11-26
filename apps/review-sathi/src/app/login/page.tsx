import type { Metadata } from "next";
import { Logo } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/dashboard";
  const signup = params.mode === "signup";
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="card">
          <h1 className="text-xl font-semibold">{signup ? "Start your free trial" : "Log in"}</h1>
          <p className="mt-1 text-sm text-stone-600">
            {signup ? "14 days free. No card needed." : "We'll email you a secure sign-in link."}
          </p>
          <LoginForm next={next} initialError={error} googleEnabled={process.env.NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN === "true"} />
        </div>
      </div>
    </main>
  );
}
