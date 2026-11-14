"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bell,
  ChevronDown,
  Clock,
  LogIn,
  Menu,
  Settings,
  UserCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserRole } from "@/types/system";

interface TopbarProps {
  onOpenMobileMenu: () => void;
  userName: string;
  role: UserRole;
  supabaseReady: boolean;
}

export function Topbar({
  onOpenMobileMenu,
  userName,
  role,
  supabaseReady,
}: TopbarProps) {
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
      {/* Left: Mobile Menu Trigger + Shift Window Indicator */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open menu"
          className="rounded-xl border border-border bg-surface p-2 text-ink hover:bg-warm lg:hidden cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2 rounded-xl bg-warm px-3 py-1.5 border border-border">
          <Clock className="h-4 w-4 text-brand" />
          <span className="text-xs font-medium text-ink">
            Shifts: 08:00–16:00 • 16:00–00:00 (PKT)
          </span>
        </div>
      </div>

      {/* Right: Connection Status, Notifications, Profile Menu */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <Badge variant={supabaseReady ? "success" : "warning"}>
          {supabaseReady ? "Cloud Connected" : "Awaiting DB Keys"}
        </Badge>

        {/* Notification Area */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setNotifOpen((prev) => !prev);
              setProfileOpen(false);
            }}
            aria-label="Notifications"
            className="relative rounded-xl border border-border bg-surface p-2 text-ink hover:bg-warm cursor-pointer"
          >
            <Bell className="h-5 w-5 text-muted" />
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-border bg-surface p-4 shadow-lg">
              <p className="text-sm font-semibold text-ink">Notifications</p>
              <p className="mt-2 text-xs text-muted">
                No system alerts yet. Shift handovers, low-stock notices, and
                sync alerts will appear here once active.
              </p>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setProfileOpen((prev) => !prev);
              setNotifOpen(false);
            }}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface px-2.5 py-1.5 text-left hover:bg-warm cursor-pointer"
          >
            <UserCircle2 className="h-6 w-6 text-brand shrink-0" />
            <div className="hidden md:block">
              <p className="text-xs font-semibold text-ink leading-none">
                {userName}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-muted">
                {role}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-border bg-surface p-2 shadow-lg">
              <div className="border-b border-border px-3 py-2">
                <p className="text-xs font-semibold text-ink">{userName}</p>
                <p className="text-[11px] text-muted">Role: {role}</p>
              </div>
              <div className="mt-1 space-y-1">
                <Link
                  href="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-ink hover:bg-warm"
                >
                  <Settings className="h-4 w-4 text-muted" />
                  System Settings
                </Link>
                <Link
                  href="/login"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-brand-dark hover:bg-brand-soft"
                >
                  <LogIn className="h-4 w-4" />
                  Staff Sign In
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
