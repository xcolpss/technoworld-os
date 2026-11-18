import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_COOKIE_NAME,
  PERSISTENCE_COOKIE_NAME,
  buildPersistenceFlagCookieOptions,
  buildSessionCookieOptions,
  type PersistenceMode,
} from "@/lib/auth/cookie-persistence";
import {
  createLocalAuthSession,
  createLocalUserAccount,
} from "@/lib/auth/local-auth";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      fullName?: string;
      email?: string;
      password?: string;
      rememberDevice?: boolean;
    };

    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const mode: PersistenceMode =
      body.rememberDevice === false ? "session" : "persistent";

    if (!email || password.length < 6) {
      return NextResponse.json(
        { ok: false, error: "Valid email and password (6+ chars) required." },
        { status: 400 }
      );
    }

    const user = await createLocalUserAccount({
      fullName: fullName || email.split("@")[0],
      email,
      password,
    });

    const { signedToken } = await createLocalAuthSession(user.id, mode);
    const isSecure = request.nextUrl.protocol === "https:";
    const response = NextResponse.json({
      ok: true,
      user,
      mode,
    });

    response.cookies.set(
      AUTH_COOKIE_NAME,
      signedToken,
      buildSessionCookieOptions(mode, isSecure)
    );
    response.cookies.set(
      PERSISTENCE_COOKIE_NAME,
      mode,
      buildPersistenceFlagCookieOptions(mode, isSecure)
    );

    return response;
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Failed to register account.",
      },
      { status: 400 }
    );
  }
}
