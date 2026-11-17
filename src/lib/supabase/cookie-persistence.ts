export const PERSISTENCE_COOKIE_NAME = "tw_persistence_mode";
export type PersistenceMode = "persistent" | "session";

const PERSISTENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface CookieOptionsLike {
  domain?: string;
  expires?: Date | number;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: "lax" | "strict" | "none" | boolean;
  secure?: boolean;
  [key: string]: unknown;
}

export interface SerializedCookieItem {
  name: string;
  value: string;
  options?: CookieOptionsLike;
}

export function parsePersistenceMode(
  rawValue?: string | null
): PersistenceMode {
  return rawValue === "session" ? "session" : "persistent";
}

export function isSupabaseAuthCookie(name: string): boolean {
  return name.startsWith("sb-") && name.includes("-auth-token");
}

export function normalizeAuthCookieOptions(
  cookieName: string,
  options: CookieOptionsLike | undefined,
  mode: PersistenceMode
): CookieOptionsLike {
  const base: CookieOptionsLike = {
    path: "/",
    ...(options ?? {}),
  };

  if (!isSupabaseAuthCookie(cookieName)) {
    return base;
  }

  if (mode === "session") {
    // Strip maxAge and expires so the browser drops auth cookies when closed,
    // while keeping them valid across page refreshes during the active session.
    const nextOptions: CookieOptionsLike = { ...base };
    delete nextOptions.maxAge;
    delete nextOptions.expires;
    return nextOptions;
  }

  // Persistent mode: preserve explicit deletion (maxAge === 0) or keep/ensure persistent maxAge.
  if (base.maxAge === 0) {
    return base;
  }

  return {
    ...base,
    maxAge:
      typeof base.maxAge === "number" && base.maxAge > 0
        ? base.maxAge
        : PERSISTENT_MAX_AGE_SECONDS,
  };
}

export function parseDocumentCookies(cookieHeader: string): Array<{
  name: string;
  value: string;
}> {
  if (!cookieHeader) return [];
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const eqIdx = part.indexOf("=");
      if (eqIdx === -1) return { name: part, value: "" };
      const name = decodeURIComponent(part.slice(0, eqIdx).trim());
      const value = decodeURIComponent(part.slice(eqIdx + 1).trim());
      return { name, value };
    });
}

export function serializeDocumentCookie(
  name: string,
  value: string,
  options?: CookieOptionsLike
): string {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  const opts = options ?? {};

  parts.push(`Path=${opts.path || "/"}`);

  if (opts.domain) {
    parts.push(`Domain=${opts.domain}`);
  }
  if (typeof opts.maxAge === "number") {
    parts.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  }
  if (opts.expires) {
    const expDate =
      opts.expires instanceof Date ? opts.expires : new Date(opts.expires);
    if (!Number.isNaN(expDate.getTime())) {
      parts.push(`Expires=${expDate.toUTCString()}`);
    }
  }
  if (opts.sameSite && typeof opts.sameSite === "string") {
    parts.push(`SameSite=${opts.sameSite}`);
  } else {
    parts.push("SameSite=Lax");
  }
  if (opts.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}
