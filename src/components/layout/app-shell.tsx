"use client";

import * as React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { UserRole } from "@/types/system";

interface AppShellProps {
  children: React.ReactNode;
  userName?: string;
  role?: UserRole;
  supabaseReady?: boolean;
}

export function AppShell({
  children,
  userName = "Shop Setup (Unauthenticated)",
  role = "OWNER",
  supabaseReady = false,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-warm text-ink">
      <Sidebar
        role={role}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="lg:pl-64 flex min-h-screen flex-col">
        <Topbar
          onOpenMobileMenu={() => setMobileOpen(true)}
          userName={userName}
          role={role}
          supabaseReady={supabaseReady}
        />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
