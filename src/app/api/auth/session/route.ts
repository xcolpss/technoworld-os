import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/cookie-persistence";
import { getAuthenticatedShopContext } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthenticatedShopContext();
    if (!ctx) {
      const response = NextResponse.json(
        { authenticated: false, user: null },
        { status: 401 }
      );
      if (request.cookies.get(AUTH_COOKIE_NAME)) {
        response.cookies.set(AUTH_COOKIE_NAME, "", {
          path: "/",
          maxAge: 0,
          expires: new Date(0),
        });
      }
      return response;
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        userId: ctx.userId,
        email: ctx.email,
        fullName: ctx.fullName,
        role: ctx.role,
        businessId: ctx.businessId,
      },
    });
  } catch {
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 500 }
    );
  }
}
