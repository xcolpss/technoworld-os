import { createBrowserClient } from "@supabase/ssr";
import {
  getSupabaseBrowserEnv,
  isSupabaseConfigured,
} from "@/lib/supabase/env";

export { isSupabaseConfigured };

export function createSupabaseBrowserClient() {
  const env = getSupabaseBrowserEnv();

  if (!env) {
    throw new Error(
      "Supabase environment variables are not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel Project Settings (or .env.local locally)."
    );
  }

  return createBrowserClient(env.url, env.anonKey);
}
