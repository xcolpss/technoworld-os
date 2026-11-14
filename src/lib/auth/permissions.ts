import { UserRole } from "@/types/system";

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  OWNER: 3,
  MANAGER: 2,
  EMPLOYEE: 1,
};

export function hasRequiredRole(
  userRole: UserRole,
  allowedRoles: readonly UserRole[]
): boolean {
  return allowedRoles.includes(userRole);
}

export function assertAuthorizedRole(
  userRole: UserRole,
  allowedRoles: readonly UserRole[],
  actionLabel: string
): void {
  if (!hasRequiredRole(userRole, allowedRoles)) {
    throw new Error(
      `Unauthorized: Role ${userRole} is not permitted to perform "${actionLabel}".`
    );
  }
}

export function canAccessOwnerCapital(userRole: UserRole): boolean {
  return userRole === "OWNER";
}

export function canManageFinancialSettings(userRole: UserRole): boolean {
  return userRole === "OWNER";
}
