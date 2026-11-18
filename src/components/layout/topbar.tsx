"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  Cloud,
  LogOut,
  Menu,
  Settings,
  Shield,
  ShoppingCart,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import type { UserRole } from "@/types/system";
import { SignOutDialog } from "@/components/auth/sign-out-dialog";
import { ActiveShiftBar } from "@/components/layout/active-shift-bar";

interface TopbarProps {
  onOpenMobileMenu?: () => void;
  userName?: string;
  userEmail?: string;
  role?: UserRole;
  businessName?: string;
  supabaseReady?: boolean;
}

function getInitials(name?: string): string {
  if (!name) return "TW";
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "TW";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function Topbar({
  onOpenMobileMenu,
  userName = "Shop User",
  userEmail = "",
  role = "EMPLOYEE",
  businessName = "TechnoWorld",
  supabaseReady = true,
}: TopbarProps = {}) {
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = React.useState(false);
  const [signOutDialogOpen, setSignOutDialogOpen] = React.useState(false);
  const notifRef = React.useRef<HTMLDivElement | null>(null);
  const accountRef = React.useRef<HTMLDivElement | null>(null);

  const initials = React.useMemo(() => getInitials(userName), [userName]);

  const handleMobileMenuClick = () => {
    if (onOpenMobileMenu) {
      onOpenMobileMenu();
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("tw-mobile-sidebar-open"));
    }
  };

  React.useEffect(() => {
    if (!notifOpen && !accountMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notifOpen && notifRef.current && !notifRef.current.contains(target)) {
        setNotifOpen(false);
      }
      if (
        accountMenuOpen &&
        accountRef.current &&
        !accountRef.current.contains(target)
      ) {
        setAccountMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNotifOpen(false);
        setAccountMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [notifOpen, accountMenuOpen]);

  return (
    <>
      <header className="h-16 glass-panel border-b px-3.5 sm:px-6 flex items-center justify-between gap-2 sticky top-0 z-30">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={handleMobileMenuClick}
            aria-label="Open navigation menu"
            className="lg:hidden h-9 w-9 rounded-xl border border-[var(--border)] bg-[var(--warm)] flex items-center justify-center text-[var(--foreground)] hover:bg-[var(--surface-secondary)] active:scale-95 transition shrink-0 cursor-pointer"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="flex sm:hidden items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#FF8533] to-[#E55800] flex items-center justify-center text-white font-black text-xs shadow-xs shrink-0">
              TW
            </div>
            <span className="font-display font-extrabold text-xs tracking-tight text-[var(--foreground)] truncate">
              {businessName}
            </span>
          </div>

          <ActiveShiftBar userRole={role} />
        </div>

        <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--success)]/20 bg-[var(--success-soft)] text-[var(--success)] text-xs font-bold shadow-[inset_0_1px_0_var(--glass-highlight)]">
            <Cloud className="h-3.5 w-3.5" />
            <span>{supabaseReady ? "Local PostgreSQL Connected" : "DB Offline"}</span>
          </div>

          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => {
                setAccountMenuOpen(false);
                setNotifOpen((prev) => !prev);
              }}
              aria-label="System notifications"
              className="relative h-9 w-9 rounded-xl border border-[var(--border)] bg-[var(--warm)] flex items-center justify-center text-[var(--foreground)] hover:border-[var(--primary)]/35 hover:bg-[var(--surface-elevated)] active:scale-95 transition shrink-0 cursor-pointer"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
            </button>

            {notifOpen && (
              <div className="glass-modal absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl p-3.5 z-50 space-y-2.5">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                  <span className="font-display text-xs font-extrabold uppercase tracking-wider text-[var(--foreground)] flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-[var(--primary)]" />
                    System Status
                  </span>
                  <span className="text-[10px] font-mono font-bold text-[var(--success)]">
                    PKT Online
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--warm)] p-2.5">
                    <CheckCircle2 className="h-4 w-4 text-[var(--success)] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-[var(--foreground)]">
                        Ledger &amp; Cloud Sync Active
                      </p>
                      <p className="text-[11px] text-[var(--foreground-secondary)]">
                        All POS bills, expenses, and inventory logs are synced.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/pos"
                    onClick={() => setNotifOpen(false)}
                    className="flex items-center justify-between rounded-xl border border-[var(--primary)]/25 bg-[var(--brand-soft)] px-3 py-2 font-bold text-[var(--primary-hover)] dark:text-[var(--primary)] hover:bg-[var(--primary)]/15 transition"
                  >
                    <span className="flex items-center gap-2">
                      <ShoppingCart className="h-3.5 w-3.5" />
                      Jump to POS Counter
                    </span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Authenticated User Profile & Account Menu */}
          <div
            className="relative pl-2 sm:pl-3 border-l border-[var(--border)]"
            ref={accountRef}
          >
            <button
              type="button"
              onClick={() => {
                setNotifOpen(false);
                setAccountMenuOpen((prev) => !prev);
              }}
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
              aria-label="Open account menu"
              className="flex items-center gap-2 sm:gap-2.5 rounded-xl p-1 pr-1.5 hover:bg-[var(--warm)] transition cursor-pointer"
            >
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#FF7B1C]/25 to-[#FF6A00]/10 border border-[var(--primary)]/25 text-[var(--primary)] flex items-center justify-center font-extrabold text-sm shadow-[inset_0_1px_0_var(--glass-highlight)] shrink-0">
                {initials}
              </div>
              <div className="hidden sm:block text-left max-w-[140px]">
                <p className="text-xs font-bold text-[var(--foreground)] leading-tight truncate">
                  {userName}
                </p>
                <p className="text-[10px] font-mono text-[var(--foreground-secondary)] uppercase truncate">
                  {role}
                </p>
              </div>
              <ChevronDown
                className={`h-3.5 w-3.5 text-[var(--foreground-secondary)] transition-transform duration-200 ${
                  accountMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {accountMenuOpen && (
              <div
                role="menu"
                className="glass-modal absolute right-0 mt-2 w-64 sm:w-72 rounded-2xl p-3 z-50 space-y-2"
              >
                <div className="rounded-xl border border-[var(--border)] bg-[var(--warm)]/80 p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[var(--foreground)] truncate">
                      <UserIcon className="h-3.5 w-3.5 text-[var(--primary)] shrink-0" />
                      <span className="truncate">{userName}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary)]/15 px-2 py-0.5 text-[10px] font-mono font-bold text-[var(--primary)] uppercase shrink-0">
                      <Shield className="h-2.5 w-2.5" />
                      {role}
                    </span>
                  </div>
                  {userEmail && (
                    <p className="text-[11px] font-mono text-[var(--foreground-secondary)] truncate">
                      {userEmail}
                    </p>
                  )}
                  <p className="text-[10px] text-[var(--muted)] truncate">
                    Workspace: {businessName}
                  </p>
                </div>

                {role === "OWNER" && (
                  <Link
                    href="/settings"
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--warm)] transition"
                  >
                    <Settings className="h-4 w-4 text-[var(--foreground-secondary)]" />
                    <span>Account &amp; Shop Settings</span>
                  </Link>
                )}

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setSignOutDialogOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <SignOutDialog
        open={signOutDialogOpen}
        onClose={() => setSignOutDialogOpen(false)}
        userName={userName}
        userEmail={userEmail}
      />
    </>
  );
}
