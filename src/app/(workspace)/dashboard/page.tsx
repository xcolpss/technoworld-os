import { redirect } from "next/navigation";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { getOwnerBiDashboardData } from "@/lib/dashboard/bi-engine";
import { OwnerBiDashboard } from "@/components/dashboard/owner-bi-dashboard";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams: Promise<{
    period?: string;
    start?: string;
    end?: string;
  }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const resolvedParams = await searchParams;
  const biData = await getOwnerBiDashboardData(
    ctx.businessId,
    resolvedParams?.period,
    resolvedParams?.start,
    resolvedParams?.end
  );

  return (
    <OwnerBiDashboard
      data={biData}
      userRole={ctx.role}
      businessName={ctx.businessName ?? "TechnoWorld"}
    />
  );
}
