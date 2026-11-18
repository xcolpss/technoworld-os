"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { SectionRefreshButton } from "@/components/ui/section-refresh-button";
import { WorkspaceSectionSkeleton } from "@/components/ui/workspace-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AllocationStackedBar } from "@/components/ui/mini-charts";
import { AccessRestricted } from "@/components/auth/access-restricted";
import { hasRequiredRole } from "@/lib/auth/permissions";
import { useWorkspaceUser } from "@/lib/workspace/context";
import { formatPkr } from "@/lib/format/currency";
import {
  fetchWorkspaceApi,
  invalidateWorkspaceCaches,
  workspaceQueryKeys,
} from "@/lib/query/cache-keys";
import {
  createAccountTransferAction,
  createFinancialAccountAction,
  recordOwnerContributionAction,
  recordOwnerDrawingAction,
} from "@/app/(workspace)/finance/actions";
import {
  ArrowRightLeft,
  Building2,
  DollarSign,
  PlusCircle,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

interface FinancePayload {
  accounts: Array<{
    id: string;
    account_name: string;
    account_type: string;
    opening_balance_paisa: number;
  }>;
  contributions: Array<{
    owner_name: string;
    contribution_type: string;
    amount_paisa: number;
    contribution_date: string;
  }>;
  drawings: Array<{
    owner_name: string;
    category: string;
    amount_paisa: number;
    purpose: string | null;
    drawing_date: string;
  }>;
  transfers: Array<{
    reference_number: string | null;
    amount_paisa: number;
    description: string | null;
    transfer_date: string;
  }>;
  summary: {
    grossSales: number;
    totalDiscounts: number;
    netSales: number;
    totalOperatingExpenses: number;
    totalOwnerContributions: number;
    totalHouseholdDrawings: number;
    totalCashAccounts: number;
    totalBankAccounts: number;
    totalDigitalAccounts: number;
    totalLiquidity: number;
  };
}

export function FinanceCachedView() {
  const user = useWorkspaceUser();
  const sp = useSearchParams();
  const allowed = hasRequiredRole(user.role, ["OWNER"]);
  const queryClient = useQueryClient();
  const queryKey = workspaceQueryKeys.finance();

  const [activeTab, setActiveTab] = React.useState(
    sp.get("tab") || "overview"
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const { data, isPending, isFetching, dataUpdatedAt } =
    useQuery<FinancePayload>({
      queryKey,
      queryFn: () => fetchWorkspaceApi<FinancePayload>("finance"),
      enabled: allowed,
    });

  if (!allowed) {
    return (
      <AccessRestricted
        currentRole={user.role}
        requiredRoles={["OWNER"]}
        sectionName="Finance & Capital Accounts"
      />
    );
  }

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/finance?tab=${tabId}`);
    }
  };

  const handleForceRefresh = async () => {
    const fresh = await queryClient.fetchQuery({
      queryKey,
      queryFn: () => fetchWorkspaceApi<FinancePayload>("finance", { fresh: true }),
      staleTime: 0,
    });
    queryClient.setQueryData(queryKey, fresh);
  };

  const submitFormAction =
    (actionFn: (fd: FormData) => Promise<void>, okMessage: string) =>
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      const fd = new FormData(form);
      setSubmitting(true);
      setFeedback(null);
      try {
        await actionFn(fd);
        form.reset();
        await invalidateWorkspaceCaches(queryClient, "finance");
        setFeedback({ type: "ok", text: okMessage });
      } catch (err) {
        setFeedback({
          type: "err",
          text: err instanceof Error ? err.message : "Operation failed.",
        });
      } finally {
        setSubmitting(false);
      }
    };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        eyebrow="TechnoWorld OS • Financial & Owner Accounting System"
        title="Finance & Owner Accounts"
        description="Double-entry general ledger, multi-owner capital contributions, household drawings, and multi-wallet liquidity management."
        actions={
          <SectionRefreshButton
            onRefresh={handleForceRefresh}
            isFetching={isFetching}
            lastUpdatedAt={dataUpdatedAt}
          />
        }
      />

      {feedback && (
        <div
          className={`rounded-xl px-4 py-2.5 text-xs font-bold border ${
            feedback.type === "ok"
              ? "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/25"
              : "bg-rose-500/10 text-rose-500 border-rose-500/25"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Instant Client Navigation Tabs */}
      <div className="glass-panel flex flex-wrap gap-1.5 sm:gap-2 rounded-2xl border p-1.5">
        {[
          { id: "overview", label: "Financial Overview", icon: DollarSign },
          { id: "accounts", label: "Accounts & Wallets", icon: Wallet },
          { id: "capital", label: "Owner Capital", icon: Building2 },
          { id: "drawings", label: "Household & Drawings", icon: Users },
          { id: "transfers", label: "Transfers & Ledger", icon: ArrowRightLeft },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleSelectTab(t.id)}
              className={`flex flex-1 sm:flex-none items-center justify-center sm:justify-start gap-2 rounded-xl px-3 sm:px-4 py-2 text-xs font-extrabold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                isActive
                  ? "bg-gradient-to-r from-[#FF7B1C] to-[#FF6A00] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_4px_12px_-2px_rgba(255,106,0,0.35)]"
                  : "text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--warm)]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t.label}
            </button>
          );
        })}
      </div>

      {isPending && !data ? (
        <WorkspaceSectionSkeleton cards={4} rows={6} />
      ) : data ? (
        <>
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-brand/30 bg-brand-soft/10">
                  <CardContent className="p-4 sm:p-5 space-y-1">
                    <span className="text-xs font-bold text-muted">
                      Total Available Liquidity
                    </span>
                    <p className="font-mono text-xl sm:text-2xl font-extrabold text-ink">
                      {formatPkr(data.summary.totalLiquidity)}
                    </p>
                    <p className="text-[10px] text-muted">
                      Cash, Bank, &amp; Wallets combined
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-surface">
                  <CardContent className="p-4 sm:p-5 space-y-1">
                    <span className="text-xs font-bold text-muted">
                      Net Sales Revenue
                    </span>
                    <p className="font-mono text-xl sm:text-2xl font-extrabold text-brand-dark">
                      {formatPkr(data.summary.netSales)}
                    </p>
                    <p className="text-[10px] text-muted">
                      Excl. {formatPkr(data.summary.totalDiscounts)} discounts
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-success/30 bg-success-soft/10">
                  <CardContent className="p-4 sm:p-5 space-y-1">
                    <span className="text-xs font-bold text-success">
                      Owner Capital Invested
                    </span>
                    <p className="font-mono text-xl sm:text-2xl font-extrabold text-success">
                      {formatPkr(data.summary.totalOwnerContributions)}
                    </p>
                    <p className="text-[10px] text-muted">
                      Subhan Shahid, Father, Brother
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-danger/30 bg-danger-soft/10">
                  <CardContent className="p-4 sm:p-5 space-y-1">
                    <span className="text-xs font-bold text-danger">
                      Household Withdrawals
                    </span>
                    <p className="font-mono text-xl sm:text-2xl font-extrabold text-danger">
                      {formatPkr(data.summary.totalHouseholdDrawings)}
                    </p>
                    <p className="text-[10px] text-muted">
                      Shop drawings &amp; personal use
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <h3 className="font-display text-base font-extrabold text-ink border-b border-border pb-3">
                      Wallet &amp; Liquidity Breakdown
                    </h3>
                    <AllocationStackedBar
                      title="Liquidity Distribution"
                      segments={[
                        {
                          label: "Cash Drawers",
                          value: data.summary.totalCashAccounts,
                          formattedValue: formatPkr(data.summary.totalCashAccounts),
                          tone: "brand",
                        },
                        {
                          label: "Bank Accounts",
                          value: data.summary.totalBankAccounts,
                          formattedValue: formatPkr(data.summary.totalBankAccounts),
                          tone: "info",
                        },
                        {
                          label: "Digital Wallets",
                          value: data.summary.totalDigitalAccounts,
                          formattedValue: formatPkr(data.summary.totalDigitalAccounts),
                          tone: "success",
                        },
                      ]}
                    />
                    <div className="space-y-2.5 font-mono text-xs pt-1">
                      <div className="flex flex-wrap items-center justify-between gap-1 p-3 rounded-xl bg-warm">
                        <span className="text-muted">Cash Drawers:</span>
                        <span className="font-bold text-ink">
                          {formatPkr(data.summary.totalCashAccounts)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-1 p-3 rounded-xl bg-warm">
                        <span className="text-muted">Bank Accounts:</span>
                        <span className="font-bold text-ink">
                          {formatPkr(data.summary.totalBankAccounts)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-1 p-3 rounded-xl bg-warm">
                        <span className="text-muted">
                          Digital Wallets (Easypaisa/JazzCash):
                        </span>
                        <span className="font-bold text-ink">
                          {formatPkr(data.summary.totalDigitalAccounts)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border bg-surface">
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <h3 className="font-display text-base font-extrabold text-ink border-b border-border pb-3">
                      Accounting Compliance
                    </h3>
                    <div className="space-y-3 text-xs">
                      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-success-soft/30 border border-success/30 text-success">
                        <ShieldCheck className="h-5 w-5 shrink-0" />
                        <span>
                          Double-entry general ledger active and balanced for Asia/Karachi timezone.
                        </span>
                      </div>
                      <p className="text-muted text-[11px]">
                        All transactions maintain audit trails linked directly to POS checkouts, inventory restocks, and shift closures.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "accounts" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Card className="border-border bg-surface">
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <h3 className="font-display text-base font-extrabold text-ink">
                      Active Business Accounts &amp; Wallets
                    </h3>

                    <div className="sm:hidden space-y-2.5">
                      {data.accounts.map((acc) => (
                        <div
                          key={acc.id}
                          className="rounded-xl border border-border bg-warm/40 p-3 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-ink text-sm break-words">
                              {acc.account_name}
                            </span>
                            <Badge variant="success">Active</Badge>
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
                            <Badge>{acc.account_type}</Badge>
                            <span className="font-mono font-bold text-brand-dark">
                              {formatPkr(acc.opening_balance_paisa || 0)}
                            </span>
                          </div>
                        </div>
                      ))}
                      {data.accounts.length === 0 && (
                        <p className="p-6 text-center text-xs text-muted">
                          No financial accounts registered yet. Use the form to add one.
                        </p>
                      )}
                    </div>

                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border bg-warm/60 text-muted">
                            <th className="p-3 font-bold">Account Name</th>
                            <th className="p-3 font-bold">Type</th>
                            <th className="p-3 font-bold">Opening Balance</th>
                            <th className="p-3 font-bold text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {data.accounts.map((acc) => (
                            <tr key={acc.id} className="hover:bg-warm/30 transition">
                              <td className="p-3 font-bold text-ink">{acc.account_name}</td>
                              <td className="p-3">
                                <Badge>{acc.account_type}</Badge>
                              </td>
                              <td className="p-3 font-mono font-bold text-brand-dark">
                                {formatPkr(acc.opening_balance_paisa || 0)}
                              </td>
                              <td className="p-3 text-right">
                                <Badge variant="success">Active</Badge>
                              </td>
                            </tr>
                          ))}
                          {data.accounts.length === 0 && (
                            <tr>
                              <td colSpan={4} className="p-6 text-center text-muted">
                                No financial accounts registered yet. Use the form to add one.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <Card className="border-border bg-surface">
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <h3 className="font-display text-sm font-extrabold text-ink flex items-center gap-2">
                      <PlusCircle className="h-4 w-4 text-brand" /> Add Financial Account
                    </h3>
                    <form
                      onSubmit={submitFormAction(
                        createFinancialAccountAction,
                        "Financial account created."
                      )}
                      className="space-y-3.5 text-xs"
                    >
                      <div>
                        <Label>Account Name</Label>
                        <Input
                          name="accountName"
                          placeholder="e.g. Meezan Bank Main"
                          className="mt-1 h-9"
                          required
                        />
                      </div>
                      <div>
                        <Label>Account Type</Label>
                        <select
                          name="accountType"
                          className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-3 font-semibold"
                        >
                          <option value="CASH">Cash Drawer</option>
                          <option value="BANK">Bank Account</option>
                          <option value="DIGITAL">Digital Wallet (Easypaisa/JazzCash)</option>
                          <option value="OWNER">Owner Account</option>
                        </select>
                      </div>
                      <div>
                        <Label>Opening Balance (Rs.)</Label>
                        <Input
                          type="number"
                          name="openingBalance"
                          defaultValue="0"
                          className="mt-1 h-9 font-mono"
                          required
                        />
                      </div>
                      <div>
                        <Label>Description / Notes</Label>
                        <Input
                          name="description"
                          placeholder="Optional notes..."
                          className="mt-1 h-9"
                        />
                      </div>
                      <Button type="submit" disabled={submitting} className="w-full mt-2">
                        {submitting ? "Saving..." : "Create Account"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "capital" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Card className="border-border bg-surface">
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <h3 className="font-display text-base font-extrabold text-ink">
                      Owner Capital Contributions
                    </h3>

                    <div className="sm:hidden space-y-2.5">
                      {data.contributions.map((c, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-border bg-warm/40 p-3 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-ink text-sm">
                              {c.owner_name}
                            </span>
                            <Badge variant="brand">{c.contribution_type}</Badge>
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
                            <span className="font-mono text-muted">
                              {new Date(c.contribution_date).toLocaleDateString()}
                            </span>
                            <span className="font-mono font-bold text-success">
                              {formatPkr(c.amount_paisa)}
                            </span>
                          </div>
                        </div>
                      ))}
                      {data.contributions.length === 0 && (
                        <p className="p-6 text-center text-xs text-muted">
                          No owner contributions recorded yet.
                        </p>
                      )}
                    </div>

                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border bg-warm/60 text-muted">
                            <th className="p-3 font-bold">Owner Name</th>
                            <th className="p-3 font-bold">Type</th>
                            <th className="p-3 font-bold">Amount</th>
                            <th className="p-3 font-bold text-right">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {data.contributions.map((c, idx) => (
                            <tr key={idx} className="hover:bg-warm/30 transition">
                              <td className="p-3 font-bold text-ink">{c.owner_name}</td>
                              <td className="p-3">
                                <Badge variant="brand">{c.contribution_type}</Badge>
                              </td>
                              <td className="p-3 font-mono font-bold text-success">
                                {formatPkr(c.amount_paisa)}
                              </td>
                              <td className="p-3 text-right font-mono text-muted">
                                {new Date(c.contribution_date).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                          {data.contributions.length === 0 && (
                            <tr>
                              <td colSpan={4} className="p-6 text-center text-muted">
                                No owner contributions recorded yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <Card className="border-border bg-surface">
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <h3 className="font-display text-sm font-extrabold text-ink flex items-center gap-2">
                      <PlusCircle className="h-4 w-4 text-brand" /> Record Contribution
                    </h3>
                    <form
                      onSubmit={submitFormAction(
                        recordOwnerContributionAction,
                        "Owner capital contribution recorded."
                      )}
                      className="space-y-3.5 text-xs"
                    >
                      <div>
                        <Label>Owner Name</Label>
                        <select
                          name="ownerName"
                          className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-3 font-semibold"
                        >
                          <option value="Subhan Shahid">Subhan Shahid</option>
                          <option value="Father">Father</option>
                          <option value="Younger Brother">Younger Brother</option>
                        </select>
                      </div>
                      <div>
                        <Label>Contribution Type</Label>
                        <select
                          name="contributionType"
                          className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-3 font-semibold"
                        >
                          <option value="CASH">Cash</option>
                          <option value="INVENTORY">Inventory Stock</option>
                          <option value="EQUIPMENT">Equipment / Asset</option>
                          <option value="LOAN">Owner Loan to Business</option>
                        </select>
                      </div>
                      <div>
                        <Label>Amount (Rs.)</Label>
                        <Input
                          type="number"
                          name="amount"
                          placeholder="e.g. 50000"
                          className="mt-1 h-9 font-mono"
                          required
                        />
                      </div>
                      <div>
                        <Label>Receiving Account</Label>
                        <select
                          name="receivingAccountId"
                          className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-3 font-semibold"
                        >
                          {data.accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.account_name} ({acc.account_type})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label>Notes / Valuation Details</Label>
                        <Input
                          name="notes"
                          placeholder="Optional details..."
                          className="mt-1 h-9"
                        />
                      </div>
                      <Button type="submit" disabled={submitting} className="w-full mt-2">
                        {submitting ? "Saving..." : "Record Capital"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "drawings" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Card className="border-border bg-surface">
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <h3 className="font-display text-base font-extrabold text-ink">
                      Household Withdrawals &amp; Owner Drawings
                    </h3>

                    <div className="sm:hidden space-y-2.5">
                      {data.drawings.map((d, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-border bg-warm/40 p-3 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-ink text-sm">
                              {d.owner_name}
                            </span>
                            <Badge variant="danger">{d.category}</Badge>
                          </div>
                          <p className="font-semibold text-ink">
                            {d.purpose || "General"}
                          </p>
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
                            <span className="font-mono text-[10px] text-muted">
                              {new Date(d.drawing_date).toLocaleDateString()}
                            </span>
                            <span className="font-mono font-bold text-danger">
                              {formatPkr(d.amount_paisa)}
                            </span>
                          </div>
                        </div>
                      ))}
                      {data.drawings.length === 0 && (
                        <p className="p-6 text-center text-xs text-muted">
                          No household withdrawals recorded yet.
                        </p>
                      )}
                    </div>

                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border bg-warm/60 text-muted">
                            <th className="p-3 font-bold">Owner Name</th>
                            <th className="p-3 font-bold">Category</th>
                            <th className="p-3 font-bold">Amount</th>
                            <th className="p-3 font-bold text-right">
                              Purpose / Date
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {data.drawings.map((d, idx) => (
                            <tr key={idx} className="hover:bg-warm/30 transition">
                              <td className="p-3 font-bold text-ink">{d.owner_name}</td>
                              <td className="p-3">
                                <Badge variant="danger">{d.category}</Badge>
                              </td>
                              <td className="p-3 font-mono font-bold text-danger">
                                {formatPkr(d.amount_paisa)}
                              </td>
                              <td className="p-3 text-right">
                                <p className="font-semibold text-ink">
                                  {d.purpose || "General"}
                                </p>
                                <p className="font-mono text-[10px] text-muted">
                                  {new Date(d.drawing_date).toLocaleDateString()}
                                </p>
                              </td>
                            </tr>
                          ))}
                          {data.drawings.length === 0 && (
                            <tr>
                              <td colSpan={4} className="p-6 text-center text-muted">
                                No household withdrawals recorded yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <Card className="border-border bg-surface">
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <h3 className="font-display text-sm font-extrabold text-ink flex items-center gap-2">
                      <PlusCircle className="h-4 w-4 text-brand" /> Record Withdrawal
                    </h3>
                    <form
                      onSubmit={submitFormAction(
                        recordOwnerDrawingAction,
                        "Household withdrawal recorded."
                      )}
                      className="space-y-3.5 text-xs"
                    >
                      <div>
                        <Label>Owner Name</Label>
                        <select
                          name="ownerName"
                          className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-3 font-semibold"
                        >
                          <option value="Subhan Shahid">Subhan Shahid</option>
                          <option value="Father">Father</option>
                          <option value="Younger Brother">Younger Brother</option>
                        </select>
                      </div>
                      <div>
                        <Label>Category</Label>
                        <select
                          name="category"
                          className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-3 font-semibold"
                        >
                          <option value="HOUSEHOLD_EXPENSE">Household Expense</option>
                          <option value="GROCERIES">Groceries</option>
                          <option value="PERSONAL_CASH">Personal Cash Draw</option>
                          <option value="ADVANCE">Owner Advance</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                      <div>
                        <Label>Amount (Rs.)</Label>
                        <Input
                          type="number"
                          name="amount"
                          placeholder="e.g. 5000"
                          className="mt-1 h-9 font-mono"
                          required
                        />
                      </div>
                      <div>
                        <Label>Source Account</Label>
                        <select
                          name="sourceAccountId"
                          className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-3 font-semibold"
                        >
                          {data.accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.account_name} ({acc.account_type})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label>Purpose / Details</Label>
                        <Input
                          name="purpose"
                          placeholder="e.g. Monthly electricity bill"
                          className="mt-1 h-9"
                        />
                      </div>
                      <Button
                        type="submit"
                        variant="danger"
                        disabled={submitting}
                        className="w-full mt-2"
                      >
                        {submitting ? "Saving..." : "Record Withdrawal"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "transfers" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Card className="border-border bg-surface">
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <h3 className="font-display text-base font-extrabold text-ink">
                      Internal Account Transfers History
                    </h3>

                    <div className="sm:hidden space-y-2.5">
                      {data.transfers.map((tr, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-border bg-warm/40 p-3 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-bold text-ink">
                              {tr.reference_number || "TR-TF"}
                            </span>
                            <span className="font-mono font-bold text-brand-dark">
                              {formatPkr(tr.amount_paisa)}
                            </span>
                          </div>
                          <p className="text-muted break-words">
                            {tr.description || "Internal transfer between wallets"}
                          </p>
                          <p className="font-mono text-[10px] text-muted pt-1 border-t border-border/60">
                            {new Date(tr.transfer_date).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                      {data.transfers.length === 0 && (
                        <p className="p-6 text-center text-xs text-muted">
                          No internal transfers recorded yet.
                        </p>
                      )}
                    </div>

                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border bg-warm/60 text-muted">
                            <th className="p-3 font-bold">Reference</th>
                            <th className="p-3 font-bold">Amount</th>
                            <th className="p-3 font-bold">Description</th>
                            <th className="p-3 font-bold text-right">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {data.transfers.map((tr, idx) => (
                            <tr key={idx} className="hover:bg-warm/30 transition">
                              <td className="p-3 font-bold font-mono text-ink">
                                {tr.reference_number || "TR-TF"}
                              </td>
                              <td className="p-3 font-mono font-bold text-brand-dark">
                                {formatPkr(tr.amount_paisa)}
                              </td>
                              <td className="p-3 text-muted">
                                {tr.description || "Internal transfer between wallets"}
                              </td>
                              <td className="p-3 text-right font-mono text-muted">
                                {new Date(tr.transfer_date).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                          {data.transfers.length === 0 && (
                            <tr>
                              <td colSpan={4} className="p-6 text-center text-muted">
                                No internal transfers recorded yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <Card className="border-border bg-surface">
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <h3 className="font-display text-sm font-extrabold text-ink flex items-center gap-2">
                      <ArrowRightLeft className="h-4 w-4 text-brand" /> Transfer Funds
                    </h3>
                    <form
                      onSubmit={submitFormAction(
                        createAccountTransferAction,
                        "Account transfer executed."
                      )}
                      className="space-y-3.5 text-xs"
                    >
                      <div>
                        <Label>Source Account</Label>
                        <select
                          name="sourceAccountId"
                          className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-3 font-semibold"
                        >
                          {data.accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.account_name} ({acc.account_type})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label>Destination Account</Label>
                        <select
                          name="destinationAccountId"
                          className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-3 font-semibold"
                        >
                          {data.accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.account_name} ({acc.account_type})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label>Amount (Rs.)</Label>
                        <Input
                          type="number"
                          name="amount"
                          placeholder="e.g. 10000"
                          className="mt-1 h-9 font-mono"
                          required
                        />
                      </div>
                      <div>
                        <Label>Reference Number</Label>
                        <Input
                          name="referenceNumber"
                          placeholder="e.g. REF-001"
                          className="mt-1 h-9 font-mono"
                        />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Input
                          name="description"
                          placeholder="Transfer notes..."
                          className="mt-1 h-9"
                        />
                      </div>
                      <Button type="submit" disabled={submitting} className="w-full mt-2">
                        {submitting ? "Executing..." : "Execute Transfer"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
