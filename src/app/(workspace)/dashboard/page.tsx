import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

interface DashboardPageProps {
  searchParams: Promise<{
    period?: string;
    start?: string;
    end?: string;
  }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = await searchParams;
  const period = resolvedSearchParams?.period || "today";

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      <PageHeader
        eyebrow="TechnoWorld OS • Owner Business Intelligence"
        title="Owner Dashboard"
        description="Real-time financial metrics, inventory intelligence, and daily operations overview."
      />

      {/* DAILY CLOSING & ACCOUNTANT SUITE PROMINENT CARD */}
      <Card className="border-[var(--primary)]/40 bg-[var(--primary)]/5 shadow-xs">
        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-[var(--primary)] text-white flex items-center justify-center font-black text-lg shadow-sm">
              <span className="font-mono">DC</span>
            </div>
            <div>
              <h3 className="font-display text-base font-extrabold text-[var(--foreground)]">Daily Closing &amp; Accountant Reports</h3>
              <p className="text-xs text-[var(--foreground-secondary)] mt-0.5">Prepare daily accounts, record wages and expenses, reconcile cash, and export your daily report.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link href="/dashboard/closing" className="w-full sm:w-auto">
              <Button className="w-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs gap-2">
                Create Daily Closing <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-6 space-y-1">
            <p className="text-xs font-bold text-[var(--foreground-secondary)] uppercase tracking-wider">Gross Sales ({period})</p>
            <h4 className="text-2xl font-black font-mono text-[var(--foreground)]">Rs. 144,850</h4>
            <p className="text-[11px] text-[var(--success)] font-semibold">+12.4% vs previous period</p>
          </CardContent>
        </Card>

        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-6 space-y-1">
            <p className="text-xs font-bold text-[var(--foreground-secondary)] uppercase tracking-wider">Net Revenue</p>
            <h4 className="text-2xl font-black font-mono text-[var(--foreground)]">Rs. 144,850</h4>
            <p className="text-[11px] text-[var(--foreground-secondary)]">Zero refunds recorded</p>
          </CardContent>
        </Card>

        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-6 space-y-1">
            <p className="text-xs font-bold text-[var(--foreground-secondary)] uppercase tracking-wider">Total Outflows</p>
            <h4 className="text-2xl font-black font-mono text-[var(--danger)]">Rs. 11,000</h4>
            <p className="text-[11px] text-[var(--foreground-secondary)]">Expenses + Staff Wages</p>
          </CardContent>
        </Card>

        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-6 space-y-1">
            <p className="text-xs font-bold text-[var(--foreground-secondary)] uppercase tracking-wider">Expected Cash Drawer</p>
            <h4 className="text-2xl font-black font-mono text-[var(--primary)]">Rs. 74,000</h4>
            <p className="text-[11px] text-[var(--foreground-secondary)]">Shift cash reconciled</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}