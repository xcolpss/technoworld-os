import "server-only";
import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseBrowserEnv,
  getSupabaseServiceRoleKey,
} from "@/lib/supabase/env";

export function createSupabaseAdminClient() {
  const env = getSupabaseBrowserEnv();
  const serviceKey = getSupabaseServiceRoleKey();

  if (!env || !serviceKey) {
    throw new Error(
      "Server-only Supabase credentials are missing. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in Vercel Project Settings."
    );
  }

  return createClient(env.url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
