import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  PERSISTENCE_COOKIE_NAME,
  normalizeAuthCookieOptions,
  parsePersistenceMode,
  type SerializedCookieItem,
} from "@/lib/supabase/cookie-persistence";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";

export async function createSupabaseServerClient() {
  // Always read cookies first so this route is treated as dynamic on Vercel.
  const cookieStore = await cookies();
  const env = getSupabaseBrowserEnv();

  if (!env) {
    throw new Error(
      "Supabase environment variables are not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel Project Settings (or .env.local locally)."
    );
  }

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: SerializedCookieItem[]) {
        try {
          const mode = parsePersistenceMode(
            cookieStore.get(PERSISTENCE_COOKIE_NAME)?.value
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(
              name,
              value,
              normalizeAuthCookieOptions(name, options, mode)
            )
          );
        } catch {
          // Called from a Server Component where setting cookies is ignored.
        }
      },
    },
  });
}
