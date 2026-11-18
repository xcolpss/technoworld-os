import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_COOKIE_NAME,
  PERSISTENCE_COOKIE_NAME,
} from "@/lib/auth/cookie-persistence";
import { revokeLocalAuthSession } from "@/lib/auth/local-auth";

export async function POST(request: NextRequest) {
  try {
    const signedCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    await revokeLocalAuthSession(signedCookie);

    const response = NextResponse.json({ ok: true });
    const isSecure = request.nextUrl.protocol === "https:";

    for (const cookieName of [AUTH_COOKIE_NAME, PERSISTENCE_COOKIE_NAME]) {
      response.cookies.set(cookieName, "", {
        path: "/",
        maxAge: 0,
        expires: new Date(0),
        sameSite: "lax",
        secure: isSecure,
      });
    }

    return response;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected error during sign out.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
