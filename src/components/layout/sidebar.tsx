"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Clock,
  Cpu,
  Landmark,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
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
        className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150 ${
          isActive
            ? "bg-gradient-to-r from-[#FF6A00] to-[#FF7F24] text-white font-semibold shadow-[0_4px_12px_rgba(255,106,0,0.28)]"
            : "text-ink/75 hover:bg-brand-soft/80 hover:text-brand-dark"
        }`}
      >
        <Icon
          className={`h-4.5 w-4.5 shrink-0 transition-transform duration-150 group-hover:scale-105 ${
            isActive ? "text-white" : "text-muted group-hover:text-brand"
          }`}
        />
        <span>{item.label}</span>
      </Link>
    );
  };

  const navContent = (
    <div className="flex h-full flex-col bg-surface border-r border-border/90 shadow-[2px_0_16px_rgba(24,27,32,0.03)]">
      {/* Brand Header */}
      <div className="flex h-17 items-center justify-between border-b border-border/80 px-5">
        <Link
          href="/dashboard"
          onClick={onCloseMobile}
          className="flex items-center gap-3"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF7B1C] to-[#E65300] text-white shadow-[0_4px_10px_rgba(255,106,0,0.3)]">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-base font-extrabold tracking-tight text-ink leading-none">
              TechnoWorld
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
              POS &amp; Business OS
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
          <p className="mb-2.5 px-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted/80">
            Shop Operations
          </p>
          <div className="space-y-1">{operationsItems.map(renderLink)}</div>
        </div>

        {adminItems.length > 0 && (
          <div>
            <p className="mb-2.5 px-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted/80">
              Management &amp; Finance
            </p>
            <div className="space-y-1">{adminItems.map(renderLink)}</div>
          </div>
        )}
      </nav>

      {/* Bottom Terminal Info */}
      <div className="border-t border-border/80 p-4">
        <div className="rounded-xl bg-gradient-to-br from-warm to-brand-soft/60 p-3.5 border border-brand/15">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-ink">
              PKR • PKT
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Live Ready
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            Asia/Karachi • 3 Terminals
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-30 lg:flex lg:w-66 lg:flex-col">
        {navContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-ink/40 backdrop-blur-[2px]"
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
