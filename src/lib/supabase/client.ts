import { createBrowserClient } from "@supabase/ssr";
import {
  PERSISTENCE_COOKIE_NAME,
  normalizeAuthCookieOptions,
  parseDocumentCookies,
  parsePersistenceMode,
  serializeDocumentCookie,
  type PersistenceMode,
  type SerializedCookieItem,
} from "@/lib/supabase/cookie-persistence";
import {
  getSupabaseBrowserEnv,
  isSupabaseConfigured,
} from "@/lib/supabase/env";

export { isSupabaseConfigured };

export function getBrowserPersistenceMode(): PersistenceMode {
  if (typeof document === "undefined") return "persistent";
  const found = parseDocumentCookies(document.cookie).find(
    (c) => c.name === PERSISTENCE_COOKIE_NAME
  );
  return parsePersistenceMode(found?.value);
}

export function setBrowserPersistenceMode(mode: PersistenceMode): void {
  if (typeof document === "undefined") return;
  const isSecure =
    typeof window !== "undefined" && window.location.protocol === "https:";
  const cookieString = serializeDocumentCookie(PERSISTENCE_COOKIE_NAME, mode, {
    path: "/",
    sameSite: "lax",
    secure: isSecure,
    maxAge: mode === "persistent" ? 60 * 60 * 24 * 365 : undefined,
  });
  document.cookie = cookieString;
}

export function applyPersistenceToExistingAuthCookies(
  mode: PersistenceMode
): void {
  if (typeof document === "undefined") return;
  const isSecure =
    typeof window !== "undefined" && window.location.protocol === "https:";
  const allCookies = parseDocumentCookies(document.cookie);
  for (const item of allCookies) {
    if (item.name.startsWith("sb-") && item.name.includes("-auth-token")) {
      const normalized = normalizeAuthCookieOptions(
        item.name,
        { path: "/", sameSite: "lax", secure: isSecure },
        mode
      );
      document.cookie = serializeDocumentCookie(
        item.name,
        item.value,
        normalized
      );
    }
  }
}

export function clearBrowserAuthArtifacts(): void {
  if (typeof document === "undefined") return;
  const isSecure =
    typeof window !== "undefined" && window.location.protocol === "https:";
  const allCookies = parseDocumentCookies(document.cookie);
  for (const item of allCookies) {
    if (
      item.name.startsWith("sb-") ||
      item.name === PERSISTENCE_COOKIE_NAME
    ) {
      document.cookie = serializeDocumentCookie(item.name, "", {
        path: "/",
        maxAge: 0,
        expires: new Date(0),
        sameSite: "lax",
        secure: isSecure,
      });
    }
  }
}

export function createSupabaseBrowserClient() {
  const env = getSupabaseBrowserEnv();

  if (!env) {
    throw new Error(
      "Supabase environment variables are not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel Project Settings (or .env.local locally)."
    );
  }

  return createBrowserClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        if (typeof document === "undefined") return [];
        return parseDocumentCookies(document.cookie);
      },
      setAll(cookiesToSet: SerializedCookieItem[]) {
        if (typeof document === "undefined") return;
        const mode = getBrowserPersistenceMode();
        const isSecure =
          typeof window !== "undefined" &&
          window.location.protocol === "https:";
        for (const { name, value, options } of cookiesToSet) {
          const normalized = normalizeAuthCookieOptions(
            name,
            {
              secure: isSecure,
              ...(options ?? {}),
            },
            mode
          );
          document.cookie = serializeDocumentCookie(name, value, normalized);
        }
      },
    },
  });
}
