"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  History,
  Clock,
  Receipt,
  Users,
  Boxes,
  Wallet,
  Users2,
  FileBarChart,
  ShieldAlert,
  Settings,
  LogOut,
  X,
} from "lucide-react";
import type { UserRole } from "@/types/system";
import { hasRequiredRole } from "@/lib/auth/permissions";
import { SignOutDialog } from "@/components/auth/sign-out-dialog";

interface NavLinkDef {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: UserRole[];
}

const shopOperations: NavLinkDef[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    allowedRoles: ["OWNER", "MANAGER", "EMPLOYEE"],
  },
  {
    name: "POS Counter",
    href: "/pos",
    icon: ShoppingCart,
    allowedRoles: ["OWNER", "MANAGER", "EMPLOYEE"],
  },
  {
    name: "Sales History",
    href: "/sales",
    icon: History,
    allowedRoles: ["OWNER", "MANAGER", "EMPLOYEE"],
  },
  {
    name: "Shifts & Cash",
    href: "/shifts",
    icon: Clock,
    allowedRoles: ["OWNER", "MANAGER", "EMPLOYEE"],
  },
  {
    name: "Expenses",
    href: "/expenses",
    icon: Receipt,
    allowedRoles: ["OWNER", "MANAGER", "EMPLOYEE"],
  },
  {
    name: "Customers",
    href: "/customers",
    icon: Users,
    allowedRoles: ["OWNER", "MANAGER", "EMPLOYEE"],
  },
];

const managementFinance: NavLinkDef[] = [
  {
    name: "Inventory",
    href: "/inventory",
    icon: Boxes,
    allowedRoles: ["OWNER", "MANAGER"],
  },
  {
    name: "Finance & Accounts",
    href: "/finance",
    icon: Wallet,
    allowedRoles: ["OWNER"],
  },
  {
    name: "Employees",
    href: "/employees",
    icon: Users2,
    allowedRoles: ["OWNER", "MANAGER"],
  },
  {
    name: "Reports",
    href: "/reports",
    icon: FileBarChart,
    allowedRoles: ["OWNER", "MANAGER"],
  },
  {
    name: "Audit Trail",
    href: "/audit",
    icon: ShieldAlert,
    allowedRoles: ["OWNER"],
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    allowedRoles: ["OWNER"],
  },
];

interface SidebarProps {
  role?: UserRole;
  userName?: string;
  userEmail?: string;
  businessName?: string;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  role = "OWNER",
  userName,
  userEmail,
  businessName = "TechnoWorld",
  mobileOpen,
  onCloseMobile,
}: SidebarProps = {}) {
  const pathname = usePathname();
  const [internalMobileOpen, setInternalMobileOpen] = React.useState(false);
  const [openedPathname, setOpenedPathname] = React.useState(pathname);
  const [signOutDialogOpen, setSignOutDialogOpen] = React.useState(false);

  const visibleShopOperations = React.useMemo(
    () =>
      shopOperations.filter((item) => hasRequiredRole(role, item.allowedRoles)),
    [role]
  );

  const visibleManagementFinance = React.useMemo(
    () =>
      managementFinance.filter((item) =>
        hasRequiredRole(role, item.allowedRoles)
      ),
    [role]
  );

  const isOpen =
    mobileOpen !== undefined
      ? mobileOpen
      : internalMobileOpen && openedPathname === pathname;

  const closeMobile = React.useCallback(() => {
    setInternalMobileOpen(false);
    onCloseMobile?.();
  }, [onCloseMobile]);

  React.useEffect(() => {
    const handleOpen = () => {
      setOpenedPathname(pathname);
      setInternalMobileOpen(true);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobile();
    };
    window.addEventListener("tw-mobile-sidebar-open", handleOpen);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("tw-mobile-sidebar-open", handleOpen);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMobile, pathname]);

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const renderNavItem = (item: NavLinkDef, showCloseButton: boolean) => {
    const Icon = item.icon;
    const isActive =
      pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={showCloseButton ? closeMobile : undefined}
        className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
          isActive
            ? "bg-gradient-to-r from-[#FF7B1C] to-[#FF6A00] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_4px_14px_-2px_rgba(255,106,0,0.38)] font-bold"
            : "text-[var(--foreground-secondary)] hover:bg-[var(--warm)] hover:text-[var(--foreground)] hover:translate-x-0.5"
        }`}
      >
        <Icon
          className={`h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-105 ${
            isActive
              ? "text-white"
              : "text-[var(--foreground-secondary)] group-hover:text-[var(--primary)]"
          }`}
        />
        <span className="truncate">{item.name}</span>
        {isActive && (
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/90 shadow-xs shrink-0" />
        )}
      </Link>
    );
  };

  const sidebarContent = (showCloseButton: boolean) => (
    <>
      <div className="p-5 border-b border-[var(--border)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#FF8533] to-[#E55800] flex items-center justify-center text-white font-black text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_12px_rgba(255,106,0,0.32)] shrink-0">
            TW
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-extrabold text-sm tracking-tight text-[var(--foreground)] truncate">
              {businessName}
            </h1>
            <p className="text-[10px] font-mono text-[var(--foreground-secondary)] uppercase tracking-wider truncate">
              POS &amp; Business OS
            </p>
          </div>
        </div>
        {showCloseButton && (
          <button
            type="button"
            onClick={closeMobile}
            aria-label="Close navigation menu"
            className="lg:hidden h-9 w-9 rounded-xl border border-[var(--border)] bg-[var(--warm)] flex items-center justify-center text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition shrink-0 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-6">
        <div>
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
            Shop Operations
          </p>
          <nav className="space-y-1">
            {visibleShopOperations.map((item) =>
              renderNavItem(item, showCloseButton)
            )}
          </nav>
        </div>

        {visibleManagementFinance.length > 0 && (
          <div>
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
              Management &amp; Finance
            </p>
            <nav className="space-y-1">
              {visibleManagementFinance.map((item) =>
                renderNavItem(item, showCloseButton)
              )}
            </nav>
          </div>
        )}
      </div>

      <div className="p-3.5 border-t border-[var(--border)] bg-[var(--warm)] space-y-2.5">
        <button
          type="button"
          onClick={() => {
            if (showCloseButton) closeMobile();
            setSignOutDialogOpen(true);
          }}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 transition cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          <span>Sign Out</span>
        </button>

        <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-mono shadow-[inset_0_1px_0_var(--glass-highlight)]">
          <span className="text-[var(--foreground-secondary)] font-semibold">
            PKR • PKT
          </span>
          <span className="inline-flex items-center gap-1.5 text-[var(--success)] font-bold text-[11px]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success)]" />
            </span>
            Live Ready
          </span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Glass Sidebar */}
      <aside className="hidden lg:flex w-64 glass-panel border-r flex-col h-screen sticky top-0 shrink-0 select-none z-40">
        {sidebarContent(false)}
      </aside>

      {/* Mobile & Smaller Tablet Collapsible Glass Drawer (<1024px) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex tw-backdrop-in"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation Menu"
        >
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeMobile}
          />
          <aside className="relative w-72 max-w-[82vw] bg-[var(--surface-elevated)] backdrop-blur-2xl border-r border-[var(--border-strong)] flex flex-col h-full shrink-0 select-none z-10 shadow-2xl">
            {sidebarContent(true)}
          </aside>
        </div>
      )}

      <SignOutDialog
        open={signOutDialogOpen}
        onClose={() => setSignOutDialogOpen(false)}
        userName={userName}
        userEmail={userEmail}
      />
    </>
  );
}
