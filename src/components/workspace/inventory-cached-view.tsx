"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { SectionRefreshButton } from "@/components/ui/section-refresh-button";
import { WorkspaceSectionSkeleton } from "@/components/ui/workspace-skeleton";
import { AccessRestricted } from "@/components/auth/access-restricted";
import { hasRequiredRole } from "@/lib/auth/permissions";
import { useWorkspaceUser } from "@/lib/workspace/context";
import {
  InventoryManager,
  type CategoryRecord,
  type InventoryItemRecord,
} from "@/components/inventory/inventory-manager";
import {
  adjustStockAction,
  createCategoryAction,
  createInventoryItemAction,
  deleteCategoryAction,
  deleteInventoryItemAction,
  updateCategoryAction,
  updateInventoryItemAction,
} from "@/app/(workspace)/inventory/actions";
import {
  fetchWorkspaceApi,
  invalidateWorkspaceCaches,
  workspaceQueryKeys,
} from "@/lib/query/cache-keys";

interface InventorySectionPayload {
  categories: CategoryRecord[];
  items: InventoryItemRecord[];
}

export function InventoryCachedView() {
  const user = useWorkspaceUser();
  const allowed = hasRequiredRole(user.role, ["OWNER", "MANAGER"]);
  const queryClient = useQueryClient();
  const queryKey = workspaceQueryKeys.inventory();

  const { data, isPending, isFetching, dataUpdatedAt } =
    useQuery<InventorySectionPayload>({
      queryKey,
      queryFn: () => fetchWorkspaceApi<InventorySectionPayload>("inventory"),
      enabled: allowed,
    });

  if (!allowed) {
    return (
      <AccessRestricted
        currentRole={user.role}
        requiredRoles={["OWNER", "MANAGER"]}
        sectionName="Inventory Management"
      />
    );
  }

  const handleForceRefresh = async () => {
    const fresh = await queryClient.fetchQuery({
      queryKey,
      queryFn: () =>
        fetchWorkspaceApi<InventorySectionPayload>("inventory", { fresh: true }),
      staleTime: 0,
    });
    queryClient.setQueryData(queryKey, fresh);
  };

  const withRefresh =
    <Args extends unknown[]>(fn: (...args: Args) => Promise<void>) =>
    async (...args: Args) => {
      await fn(...args);
      await invalidateWorkspaceCaches(queryClient, "inventory");
    };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Stock Control & Warehousing"
        title="Inventory Intelligence Center"
        description="Manage product categories, stock quantities, SKU assets, valuation, and rapid inventory adjustments."
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
        <InventoryManager
          categories={data.categories}
          items={data.items}
          onCreateCategory={withRefresh(createCategoryAction)}
          onUpdateCategory={withRefresh(updateCategoryAction)}
          onDeleteCategory={withRefresh(deleteCategoryAction)}
          onCreateItem={withRefresh(createInventoryItemAction)}
          onUpdateItem={withRefresh(updateInventoryItemAction)}
          onAdjustStock={withRefresh(adjustStockAction)}
          onDeleteItem={withRefresh(deleteInventoryItemAction)}
        />
      ) : null}
    </div>
  );
}
