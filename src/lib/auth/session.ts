import { cache } from "react";
import { cookies } from "next/headers";
import { dbQueryOne } from "@/lib/db/pool";
import { AUTH_COOKIE_NAME } from "@/lib/auth/cookie-persistence";
import {
  extractVerifiedRawToken,
  hashSessionToken,
} from "@/lib/auth/local-auth";
import type { UserRole } from "@/types/system";

export interface AuthenticatedShopContext {
  userId: string;
  email: string;
  fullName: string;
  businessId: string | null;
  businessName: string | null;
  role: UserRole;
  employeeId: string | null;
}

export const getAuthenticatedShopContext = cache(
  async (): Promise<AuthenticatedShopContext | null> => {
    const cookieStore = await cookies();
    const signedCookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const rawToken = extractVerifiedRawToken(signedCookie);
    if (!rawToken) {
      return null;
    }

    const tokenHash = hashSessionToken(rawToken);
    const row = await dbQueryOne<{
      user_id: string;
      email: string;
      full_name: string | null;
      business_id: string | null;
      business_name: string | null;
      role_code: string | null;
      employee_id: string | null;
    }>(
      `SELECT
         s.user_id,
         u.email,
         COALESCE(p.full_name, u.full_name, split_part(u.email, '@', 1)) AS full_name,
         m.business_id,
         b.name AS business_name,
         r.code AS role_code,
         e.id AS employee_id
       FROM public.auth_sessions s
       JOIN public.auth_users u ON u.id = s.user_id
       LEFT JOIN public.profiles p ON p.id = u.id
       LEFT JOIN public.memberships m ON m.profile_id = u.id AND m.status = 'ACTIVE'
       LEFT JOIN public.businesses b ON b.id = m.business_id
       LEFT JOIN public.roles r ON r.id = m.role_id
       LEFT JOIN public.employees e ON e.business_id = m.business_id
         AND e.profile_id = u.id
       WHERE s.token_hash = $1
         AND s.expires_at > now()
       ORDER BY m.created_at ASC NULLS LAST
       LIMIT 1`,
      [tokenHash]
    );

    if (!row) {
      return null;
    }

    return {
      userId: row.user_id,
      email: row.email,
      fullName: row.full_name || "Shop User",
      businessId: row.business_id,
      businessName: row.business_id ? row.business_name || "TechnoWorld" : null,
      role: row.business_id
        ? ((row.role_code as UserRole) || "EMPLOYEE")
        : "OWNER",
      employeeId: row.employee_id,
    };
  }
);
