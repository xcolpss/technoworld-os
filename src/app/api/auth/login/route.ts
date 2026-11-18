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
  verifyUserCredentials,
} from "@/lib/auth/local-auth";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
      rememberDevice?: boolean;
    };

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const mode: PersistenceMode =
      body.rememberDevice === false ? "session" : "persistent";

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "Email and password are required." },
        { status: 400 }
      );
    }

    const user = await verifyUserCredentials(email, password);
    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Invalid email or password. Please check your credentials and try again.",
        },
        { status: 401 }
      );
    }

    const { signedToken } = await createLocalAuthSession(user.id, mode);
    const isSecure = request.nextUrl.protocol === "https:";
    const response = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, fullName: user.fullName },
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
          err instanceof Error ? err.message : "Authentication request failed.",
      },
      { status: 500 }
    );
  }
}
