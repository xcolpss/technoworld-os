import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_COOKIE_NAME,
  PERSISTENCE_COOKIE_NAME,
  buildPersistenceFlagCookieOptions,
  buildSessionCookieOptions,
  type PersistenceMode,
} from "@/lib/auth/cookie-persistence";
import { updateSessionPersistenceInDb } from "@/lib/auth/local-auth";

export async function POST(request: NextRequest) {
  let body: { rememberDevice?: boolean } = {};
  try {
    body = (await request.json()) as { rememberDevice?: boolean };
  } catch {
    body = {};
  }

  const mode: PersistenceMode =
    body.rememberDevice === false ? "session" : "persistent";

  const signedSession = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  await updateSessionPersistenceInDb(signedSession, mode);

  const response = NextResponse.json({ ok: true, mode });
  const isSecure = request.nextUrl.protocol === "https:";

  response.cookies.set(
    PERSISTENCE_COOKIE_NAME,
    mode,
    buildPersistenceFlagCookieOptions(mode, isSecure)
  );

  if (signedSession) {
    response.cookies.set(
      AUTH_COOKIE_NAME,
      signedSession,
      buildSessionCookieOptions(mode, isSecure)
    );
  }

  return response;
}
