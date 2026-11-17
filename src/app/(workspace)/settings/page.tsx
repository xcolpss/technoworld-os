import { redirect } from "next/navigation";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { hasRequiredRole } from "@/lib/auth/permissions";
import { AccessRestricted } from "@/components/auth/access-restricted";
import { SettingsClient } from "@/components/settings/settings-client";

export default async function SettingsPage() {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  if (!hasRequiredRole(ctx.role, ["OWNER"])) {
    return (
      <AccessRestricted
        currentRole={ctx.role}
        requiredRoles={["OWNER"]}
        sectionName="System Settings"
      />
    );
  }

  return <SettingsClient businessName={ctx.businessName ?? "TechnoWorld"} />;
}
