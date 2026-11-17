import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { SessionGuard } from "@/components/auth/session-guard";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAuthenticatedShopContext();

  if (!ctx) {
    redirect("/login");
  }

  if (!ctx.businessId) {
    redirect("/setup");
  }

  return (
    <div className="min-h-screen bg-[var(--background)] tw-ambient-canvas flex relative">
      <SessionGuard expectedUserId={ctx.userId} />
      <Sidebar
        role={ctx.role}
        userName={ctx.fullName}
        userEmail={ctx.email}
        businessName={ctx.businessName ?? "TechnoWorld"}
      />
      <div className="flex-1 flex flex-col min-w-0 relative">
        <Topbar
          userName={ctx.fullName}
          userEmail={ctx.email}
          role={ctx.role}
          businessName={ctx.businessName ?? "TechnoWorld"}
          supabaseReady={isSupabaseConfigured()}
        />
        <main className="flex-1 p-3.5 sm:p-6 md:p-8 overflow-x-hidden overflow-y-auto tw-page-in">
          {children}
        </main>
      </div>
    </div>
  );
}
