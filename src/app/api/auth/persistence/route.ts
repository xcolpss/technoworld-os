import { NextResponse, type NextRequest } from "next/server";
import {
  PERSISTENCE_COOKIE_NAME,
  normalizeAuthCookieOptions,
  type PersistenceMode,
} from "@/lib/supabase/cookie-persistence";

export async function POST(request: NextRequest) {
  let body: { rememberDevice?: boolean } = {};
  try {
    body = (await request.json()) as { rememberDevice?: boolean };
  } catch {
    body = {};
  }

  const mode: PersistenceMode =
    body.rememberDevice === false ? "session" : "persistent";

  const response = NextResponse.json({ ok: true, mode });
  const isSecure = request.nextUrl.protocol === "https:";

  response.cookies.set(PERSISTENCE_COOKIE_NAME, mode, {
    path: "/",
    sameSite: "lax",
    secure: isSecure,
    ...(mode === "persistent" ? { maxAge: 60 * 60 * 24 * 365 } : {}),
  });

  // Also normalize any currently present Supabase auth cookies on this response
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")) {
      response.cookies.set(
        cookie.name,
        cookie.value,
        normalizeAuthCookieOptions(
          cookie.name,
          { path: "/", sameSite: "lax", secure: isSecure },
          mode
        )
      );
    }
  }

  return response;
}
