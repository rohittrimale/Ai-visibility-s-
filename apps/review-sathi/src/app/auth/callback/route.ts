import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

/** Finishes sign-in from a magic link (PKCE code or token hash) or Google login. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const supabase = await createSupabaseServerClient();

  let error: string | null = null;
  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error?.message ?? null;
  } else if (tokenHash && type) {
    const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    error = result.error?.message ?? null;
  } else {
    error = searchParams.get("error_description") ?? "That sign-in link is not valid.";
  }

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("That sign-in link expired or was already used. Please request a new one.")}`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
