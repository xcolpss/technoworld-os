import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  PERSISTENCE_COOKIE_NAME,
  normalizeAuthCookieOptions,
  parsePersistenceMode,
  type SerializedCookieItem,
} from "@/lib/supabase/cookie-persistence";

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

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return supabaseResponse;
  }

  const persistenceMode = parsePersistenceMode(
    request.cookies.get(PERSISTENCE_COOKIE_NAME)?.value
  );

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: SerializedCookieItem[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(
            name,
            value,
            normalizeAuthCookieOptions(name, options, persistenceMode)
          )
        );
      },
    },
  });

  // getUser() validates the access token with Supabase Auth and triggers secure refresh when needed
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (!user && isProtected) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    const fullTarget = `${pathname}${request.nextUrl.search}`;
    if (fullTarget && fullTarget !== "/login") {
      loginUrl.searchParams.set("next", fullTarget);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = "/dashboard";
    dashUrl.search = "";
    return NextResponse.redirect(dashUrl);
  }

  return supabaseResponse;
}
