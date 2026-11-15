import { cache } from "react";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getSupabaseBrowserEnv,
  getSupabaseServiceRoleKey,
} from "@/lib/supabase/env";
import { UserRole } from "@/types/system";

export interface AuthenticatedShopContext {
  userId: string;
  email: string;
  fullName: string;
  businessId: string | null;
  businessName: string | null;
  role: UserRole;
}

export const getAuthenticatedShopContext = cache(
  async (): Promise<AuthenticatedShopContext | null> => {
    // Mark the route dynamic even when env vars are missing at build time.
    await cookies();

    if (!getSupabaseBrowserEnv() || !getSupabaseServiceRoleKey()) {
      return null;
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user;
    if (!user) {
      return null;
    }

    const admin = createSupabaseAdminClient();

    // Run profile and membership lookups in parallel instead of sequentially
    const [{ data: profile }, { data: membership }] = await Promise.all([
      admin
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle(),
      admin
        .from("memberships")
        .select(
          `
          business_id,
          status,
          businesses ( name ),
          roles ( code )
        `
        )
        .eq("profile_id", user.id)
        .eq("status", "ACTIVE")
        .limit(1)
        .maybeSingle(),
    ]);

    const fallbackName =
      profile?.full_name ||
      (typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : user.email?.split("@")[0] ?? "Shop User");

    if (!membership) {
      return {
        userId: user.id,
        email: user.email ?? "",
        fullName: fallbackName,
        businessId: null,
        businessName: null,
        role: "OWNER",
      };
    }

    const bizRecord = Array.isArray(membership.businesses)
      ? membership.businesses[0]
      : membership.businesses;
    const roleRecord = Array.isArray(membership.roles)
      ? membership.roles[0]
      : membership.roles;

    return {
      userId: user.id,
      email: user.email ?? "",
      fullName: fallbackName,
      businessId: membership.business_id,
      businessName: bizRecord?.name ?? "TechnoWorld",
      role: (roleRecord?.code as UserRole) ?? "EMPLOYEE",
    };
  }
);
