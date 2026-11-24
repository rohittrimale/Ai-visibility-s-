import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Cookie-bound client acting as the logged-in user (RLS applies). */
export async function createUserClient() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => jar.set(name, value, options)); } catch { /* called from a Server Component; proxy refreshes sessions */ }
      },
    },
  });
}

export const supabaseConfigured = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
