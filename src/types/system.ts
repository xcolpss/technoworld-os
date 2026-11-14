export type UserRole = "OWNER" | "MANAGER" | "EMPLOYEE";

export type ShiftWindow = "MORNING" | "EVENING";

export type RecordStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED" | "VOIDED";

export interface StaffSessionProfile {
  id: string;
  fullName: string;
  role: UserRole;
  terminalName: string;
  activeShift: ShiftWindow;
}

export interface NavItem {
  label: string;
  href: string;
  iconName: string;
  allowedRoles: UserRole[];
  section: "OPERATIONS" | "FINANCE_ADMIN";
}
