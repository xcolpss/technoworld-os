"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { SectionRefreshButton } from "@/components/ui/section-refresh-button";
import { WorkspaceSectionSkeleton } from "@/components/ui/workspace-skeleton";
import {
  ExpensesManager,
  type ExpenseRecord,
  type MovementRecord,
  type OpenDrawerOption,
} from "@/components/expenses/expenses-manager";
import {
  adjustAccountBalanceAction,
  createExpenseAction,
  deleteExpenseAction,
  transferBetweenAccountsAction,
  type AccountBucket,
} from "@/app/(workspace)/expenses/actions";
import {
  fetchWorkspaceApi,
  invalidateWorkspaceCaches,
  workspaceQueryKeys,
} from "@/lib/query/cache-keys";

interface ExpensesSectionPayload {
  expenses: ExpenseRecord[];
  movements: MovementRecord[];
  accountBalancesPaisa: Record<AccountBucket, number>;
  openDrawers: OpenDrawerOption[];
  todayPk: string;
}

export function ExpensesCachedView() {
  const queryClient = useQueryClient();
  const queryKey = workspaceQueryKeys.expenses();

  const { data, isPending, isFetching, dataUpdatedAt } =
    useQuery<ExpensesSectionPayload>({
      queryKey,
      queryFn: () => fetchWorkspaceApi<ExpensesSectionPayload>("expenses"),
    });

  const handleForceRefresh = async () => {
    const fresh = await queryClient.fetchQuery({
      queryKey,
      queryFn: () =>
        fetchWorkspaceApi<ExpensesSectionPayload>("expenses", { fresh: true }),
      staleTime: 0,
    });
    queryClient.setQueryData(queryKey, fresh);
  };

  const withRefresh =
    <Args extends unknown[]>(fn: (...args: Args) => Promise<void>) =>
    async (...args: Args) => {
      await fn(...args);
      await invalidateWorkspaceCaches(queryClient, "expense");
    };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Treasury, Wallets & Expenses"
        title="Expenses & Account Balances"
        description="Track Cash in Till, Cash in Hand, EasyPaisa, JazzCash & Bank balances — log expenses, transfer funds, and reconcile balances with full audit logging."
        actions={
          <SectionRefreshButton
            onRefresh={handleForceRefresh}
            isFetching={isFetching}
            lastUpdatedAt={dataUpdatedAt}
          />
        }
      />

      {isPending && !data ? (
        <WorkspaceSectionSkeleton cards={4} rows={7} />
      ) : data ? (
        <ExpensesManager
          expenses={data.expenses}
          movements={data.movements}
          accountBalancesPaisa={data.accountBalancesPaisa}
          openDrawers={data.openDrawers}
          todayPk={data.todayPk}
          onCreateExpense={withRefresh(createExpenseAction)}
          onDeleteExpense={withRefresh(deleteExpenseAction)}
          onTransferAccounts={withRefresh(transferBetweenAccountsAction)}
          onAdjustBalance={withRefresh(adjustAccountBalanceAction)}
        />
      ) : null}
    </div>
  );
}
