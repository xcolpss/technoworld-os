import { redirect } from "next/navigation";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { formatPkDateStr } from "@/lib/dashboard/bi-engine";
import { loadClosingDataForDate } from "@/app/(workspace)/dashboard/closing/actions";
import { DailyClosingClient } from "@/components/dashboard/daily-closing-client";

export const dynamic = "force-dynamic";

interface DailyClosingPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function DailyClosingPage({
  searchParams,
}: DailyClosingPageProps) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const resolved = await searchParams;
  const targetDate = resolved?.date || formatPkDateStr();
  const { record, history } = await loadClosingDataForDate(targetDate);

  return (
    <DailyClosingClient
      initialRecord={record}
      initialHistory={history}
      businessName={ctx.businessName ?? "TechnoWorld"}
    />
  );
}
