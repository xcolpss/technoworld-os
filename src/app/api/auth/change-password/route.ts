import { NextResponse, type NextRequest } from "next/server";
import { changeLocalUserPassword } from "@/lib/auth/local-auth";
import { getAuthenticatedShopContext } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthenticatedShopContext();
    if (!ctx) {
      return NextResponse.json(
        { ok: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      currentPassword?: string;
      newPassword?: string;
    };
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");

    if (newPassword.length < 6) {
      return NextResponse.json(
        { ok: false, error: "New password must be at least 6 characters." },
        { status: 400 }
      );
    }

    await changeLocalUserPassword(ctx.userId, currentPassword, newPassword);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Failed to change password.",
      },
      { status: 400 }
    );
  }
}
