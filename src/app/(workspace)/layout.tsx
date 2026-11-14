import { AppShell } from "@/components/layout/app-shell";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabaseReady = isSupabaseConfigured();

  return (
    <AppShell
      userName="Shop Setup (Phase 1)"
      role="OWNER"
      supabaseReady={supabaseReady}
    >
      {children}
    </AppShell>
  );
}
