import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/cookie-persistence";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/pos",
  "/inventory",
  "/sales",
  "/finance",
  "/expenses",
  "/employees",
  "/staff",
  "/shifts",
  "/customers",
  "/reports",
  "/audit",
  "/settings",
  "/setup",
];

function getSessionSecret(): string {
  return (
    process.env.AUTH_SESSION_SECRET ||
    "tw-local-os-session-secret-key-2026-technoworld-rawalpindi"
  );
}

async function hasValidSignedSessionCookie(signedValue?: string): Promise<boolean> {
  if (!signedValue) return false;
  const dotIdx = signedValue.lastIndexOf(".");
  if (dotIdx <= 0) return false;
  const rawToken = signedValue.slice(0, dotIdx);
  const sigHex = signedValue.slice(dotIdx + 1);
  if (!rawToken || sigHex.length !== 64) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(getSessionSecret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(rawToken));
    const expectedHex = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (expectedHex.length !== sigHex.length) return false;
    let diff = 0;
    for (let i = 0; i < expectedHex.length; i++) {
      diff |= expectedHex.charCodeAt(i) ^ sigHex.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (!isProtected && pathname !== "/login") {
    return NextResponse.next({ request });
  }

  const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const hasValidToken = await hasValidSignedSessionCookie(sessionCookie);

  if (!hasValidToken && isProtected) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    const fullTarget = `${pathname}${request.nextUrl.search}`;
    if (fullTarget && fullTarget !== "/login") {
      loginUrl.searchParams.set("next", fullTarget);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (hasValidToken && pathname === "/login") {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = "/dashboard";
    dashUrl.search = "";
    return NextResponse.redirect(dashUrl);
  }

  return NextResponse.next({ request });
}
