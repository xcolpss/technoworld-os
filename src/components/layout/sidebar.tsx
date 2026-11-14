"use client";

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
} from "lucide-react";

const shopOperations = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "POS Counter", href: "/pos", icon: ShoppingCart },
  { name: "Sales History", href: "/sales", icon: History },
  { name: "Shifts & Cash", href: "/shifts", icon: Clock },
  { name: "Expenses", href: "/expenses", icon: Receipt },
  { name: "Customers", href: "/customers", icon: Users },
];

const managementFinance = [
  { name: "Inventory", href: "/inventory", icon: Boxes },
  { name: "Finance & Accounts", href: "/finance", icon: Wallet },
  { name: "Employees", href: "/employees", icon: Users2 },
  { name: "Reports", href: "/reports", icon: FileBarChart },
  { name: "Audit Trail", href: "/audit", icon: ShieldAlert },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col h-screen sticky top-0 shrink-0 select-none z-40">
      <div className="p-5 border-b border-[var(--border)] flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-[var(--primary)] flex items-center justify-center text-white font-black text-lg shadow-sm">
          TW
        </div>
        <div>
          <h1 className="font-display font-extrabold text-sm tracking-tight text-[var(--foreground)]">TechnoWorld</h1>
          <p className="text-[10px] font-mono text-[var(--foreground-secondary)] uppercase tracking-wider">POS &amp; Business OS</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--foreground-secondary)]">Shop Operations</p>
          <nav className="space-y-1">
            {shopOperations.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-[var(--primary)] text-white shadow-sm font-bold"
                      : "text-[var(--foreground-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-[var(--foreground-secondary)]"}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div>
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--foreground-secondary)]">Management &amp; Finance</p>
          <nav className="space-y-1">
            {managementFinance.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-[var(--primary)] text-white shadow-sm font-bold"
                      : "text-[var(--foreground-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-[var(--foreground-secondary)]"}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="p-4 border-t border-[var(--border)] bg-[var(--surface-secondary)]">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[var(--foreground-secondary)]">PKR • PKT</span>
          <span className="inline-flex items-center gap-1.5 text-[var(--success)] font-bold text-[11px]">
            <span className="h-2 w-2 rounded-full bg-[var(--success)] animate-pulse" /> Live Ready
          </span>
        </div>
      </div>
    </aside>
  );
}