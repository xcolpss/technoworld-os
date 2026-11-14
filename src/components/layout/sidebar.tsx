"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Clock,
  Landmark,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  UserCog,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { APP_NAVIGATION } from "@/config/navigation";
import { UserRole } from "@/types/system";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Clock,
  Wallet,
  Users,
  Package,
  Landmark,
  UserCog,
  BarChart3,
  ShieldCheck,
  Settings,
};

interface SidebarProps {
  role: UserRole;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ role, mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();

  const visibleItems = APP_NAVIGATION.filter((item) =>
    item.allowedRoles.includes(role)
  );
  const operationsItems = visibleItems.filter(
    (item) => item.section === "OPERATIONS"
  );
  const adminItems = visibleItems.filter(
    (item) => item.section === "FINANCE_ADMIN"
  );

  const renderLink = (item: (typeof APP_NAVIGATION)[number]) => {
    const Icon = iconMap[item.iconName] ?? LayoutDashboard;
    const isActive =
      pathname === item.href || pathname.startsWith(`${item.href}/`);

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onCloseMobile}
        className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? "bg-brand text-white shadow-sm"
            : "text-ink/80 hover:bg-brand-soft hover:text-brand-dark"
        }`}
      >
        <Icon
          className={`h-4.5 w-4.5 shrink-0 ${
            isActive ? "text-white" : "text-muted"
          }`}
        />
        <span>{item.label}</span>
      </Link>
    );
  };

  const navContent = (
    <div className="flex h-full flex-col bg-surface border-r border-border">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-border px-5">
        <Link
          href="/dashboard"
          onClick={onCloseMobile}
          className="flex items-center gap-3"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-ink leading-none">
              TechnoWorld
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-brand">
              OS • Retail & Services
            </p>
          </div>
        </Link>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="rounded-lg p-1.5 text-muted hover:bg-warm lg:hidden cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3.5 py-5">
        <div>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
            Shop Operations
          </p>
          <div className="space-y-1">{operationsItems.map(renderLink)}</div>
        </div>

        {adminItems.length > 0 && (
          <div>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
              Management & Finance
            </p>
            <div className="space-y-1">{adminItems.map(renderLink)}</div>
          </div>
        )}
      </nav>

      {/* Bottom Terminal Info */}
      <div className="border-t border-border p-4">
        <div className="rounded-xl bg-warm p-3 border border-border/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink">
              Currency: PKR
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
              <span className="h-2 w-2 rounded-full bg-success" />
              Foundation
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            Timezone: Asia/Karachi
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-30 lg:flex lg:w-64 lg:flex-col">
        {navContent}
      </aside>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-ink/40 backdrop-blur-[1px]"
            onClick={onCloseMobile}
          />
          <aside className="relative z-50 flex w-72 max-w-[85vw] flex-col">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
