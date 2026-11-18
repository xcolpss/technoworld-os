"use client";

import * as React from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { SectionRefreshButton } from "@/components/ui/section-refresh-button";
import { WorkspaceSectionSkeleton } from "@/components/ui/workspace-skeleton";
import {
  SalesHistoryManager,
  type CatalogPickerOption,
  type SaleRecord,
  type SavedClosingRecord,
} from "@/components/sales/sales-history-manager";
import {
  updateExistingSaleAction,
  voidSaleAction,
  type UpdateSalePayload,
} from "@/app/(workspace)/sales/actions";
import {
  voidDailyClosingAction,
  type ClosingShiftLabel,
} from "@/app/(workspace)/dashboard/closing/actions";
import { useWorkspaceUser } from "@/lib/workspace/context";
import {
  fetchWorkspaceApi,
  invalidateWorkspaceCaches,
  workspaceQueryKeys,
} from "@/lib/query/cache-keys";

interface SalesSectionPayload {
  sales: SaleRecord[];
  closings?: SavedClosingRecord[];
  catalogOptions: CatalogPickerOption[];
  todayPk: string;
}

export function SalesCachedView() {
  const queryClient = useQueryClient();
  const user = useWorkspaceUser();
  const queryKey = workspaceQueryKeys.sales(200);

  const { data, isPending, isFetching, dataUpdatedAt } =
    useQuery<SalesSectionPayload>({
      queryKey,
      queryFn: () => fetchWorkspaceApi<SalesSectionPayload>("sales?limit=200"),
      placeholderData: keepPreviousData,
    });

  const handleForceRefresh = async () => {
    const fresh = await queryClient.fetchQuery({
      queryKey,
      queryFn: () =>
        fetchWorkspaceApi<SalesSectionPayload>("sales?limit=200", { fresh: true }),
      staleTime: 0,
    });
    queryClient.setQueryData(queryKey, fresh);
  };

  const handleVoidSale = async (saleId: string) => {
    await voidSaleAction(saleId);
    await invalidateWorkspaceCaches(queryClient, "sale");
  };

  const handleUpdateSale = async (payload: UpdateSalePayload) => {
    await updateExistingSaleAction(payload);
    await invalidateWorkspaceCaches(queryClient, "sale");
  };

  const handleVoidClosing = async (payload: {
    closingId: string;
    closingDate: string;
    shiftLabel: ClosingShiftLabel;
    reason: string;
  }) => {
    await voidDailyClosingAction(payload);
    await invalidateWorkspaceCaches(queryClient, "closing");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Daily Closing & Fraud Control"
        title="Sales History & Daily Report"
        description="Inspect saved Daily Closings, void erroneous closings, edit past bills, reprint thermal receipts, and audit flagged bills."
        actions={
          <SectionRefreshButton
            onRefresh={handleForceRefresh}
            isFetching={isFetching}
            lastUpdatedAt={dataUpdatedAt}
          />
        }
      />

      {isPending && !data ? (
        <WorkspaceSectionSkeleton cards={4} rows={8} />
      ) : data ? (
        <SalesHistoryManager
          sales={data.sales}
          closings={data.closings ?? []}
          catalogOptions={data.catalogOptions}
          todayPk={data.todayPk}
          userRole={user.role}
          onVoidSale={handleVoidSale}
          onUpdateSale={handleUpdateSale}
          onVoidClosing={handleVoidClosing}
        />
      ) : null}
    </div>
  );
}
