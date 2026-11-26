"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginForm({ next, initialError, googleEnabled }: { next: string; initialError: string | null; googleEnabled: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(initialError);

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setState("sending");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo(), shouldCreateUser: true },
    });
    if (error) {
      setError(error.message);
      setState("idle");
      return;
    }
    setState("sent");
  }

  async function google() {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
    if (error) setError(error.message);
  }

  if (state === "sent") {
    return (
      <div className="mt-4 rounded-lg bg-brand-50 p-4 text-sm text-brand-800">
        Check <strong>{email}</strong> for a sign-in link. It may take a minute, and it might land in Promotions or Spam.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {googleEnabled && (
        <>
          <button type="button" onClick={google} className="btn-secondary w-full">
            Continue with Google
          </button>
          <div className="flex items-center gap-3 text-xs text-stone-400">
            <span className="h-px flex-1 bg-stone-200" /> or <span className="h-px flex-1 bg-stone-200" />
          </div>
        </>
      )}
      <form onSubmit={sendLink} className="space-y-3">
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="input"
            placeholder="you@yourshop.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
