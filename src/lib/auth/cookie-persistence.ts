export const AUTH_COOKIE_NAME = "tw_session";
export const PERSISTENCE_COOKIE_NAME = "tw_persistence_mode";
export type PersistenceMode = "persistent" | "session";

export const PERSISTENT_SESSION_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const EPHEMERAL_SESSION_DB_SECONDS = 60 * 60 * 24; // 24 hours DB cap while browser cookie has no Max-Age

export function parsePersistenceMode(rawValue?: string | null): PersistenceMode {
  return rawValue === "session" ? "session" : "persistent";
}

export function buildSessionCookieOptions(
  mode: PersistenceMode,
  isSecure: boolean
): {
  httpOnly: boolean;
  sameSite: "lax";
  path: string;
  secure: boolean;
  maxAge?: number;
} {
  if (mode === "session") {
    // No maxAge / expires -> true browser session cookie deleted when browser closes
    return {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isSecure,
    };
  }

  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isSecure,
    maxAge: PERSISTENT_SESSION_SECONDS,
  };
}

export function buildPersistenceFlagCookieOptions(
  mode: PersistenceMode,
  isSecure: boolean
): {
  httpOnly: boolean;
  sameSite: "lax";
  path: string;
  secure: boolean;
  maxAge?: number;
} {
  return {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    secure: isSecure,
    ...(mode === "persistent" ? { maxAge: 60 * 60 * 24 * 365 } : {}),
  };
}
