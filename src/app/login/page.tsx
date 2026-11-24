"use client";
import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function Login() {
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setState("busy");
    setError(null);
    const { error } = await createBrowserSupabase().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) { setError(error.message); setState("idle"); } else setState("sent");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <div className="card">
        <h1 className="text-xl font-bold">Log in</h1>
        {state === "sent" ? (
          <p className="mt-3 text-slate-600">Check your inbox: we sent you a sign-in link.</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className="input" autoComplete="email" />
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <button className="btn w-full" disabled={state === "busy"}>Email me a sign-in link</button>
          </form>
        )}
      </div>
    </div>
  );
}
