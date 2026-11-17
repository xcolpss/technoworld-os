import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PERSISTENCE_COOKIE_NAME } from "@/lib/supabase/cookie-persistence";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to terminate session." },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ ok: true });
    const isSecure = request.nextUrl.protocol === "https:";

    for (const cookie of request.cookies.getAll()) {
      if (
        cookie.name.startsWith("sb-") ||
        cookie.name === PERSISTENCE_COOKIE_NAME
      ) {
        response.cookies.set(cookie.name, "", {
          path: "/",
          maxAge: 0,
          expires: new Date(0),
          sameSite: "lax",
          secure: isSecure,
        });
      }
    }

    return response;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected error during sign out.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
