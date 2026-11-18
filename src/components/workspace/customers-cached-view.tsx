"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { SectionRefreshButton } from "@/components/ui/section-refresh-button";
import { WorkspaceSectionSkeleton } from "@/components/ui/workspace-skeleton";
import {
  CustomersManager,
  type CustomerRecord,
} from "@/components/customers/customers-manager";
import {
  createCustomerAction,
  recordRepaymentAction,
} from "@/app/(workspace)/customers/actions";
import {
  fetchWorkspaceApi,
  invalidateWorkspaceCaches,
  workspaceQueryKeys,
} from "@/lib/query/cache-keys";

interface CustomersSectionPayload {
  customers: CustomerRecord[];
}

export function CustomersCachedView() {
  const queryClient = useQueryClient();
  const queryKey = workspaceQueryKeys.customers();

  const { data, isPending, isFetching, dataUpdatedAt } =
    useQuery<CustomersSectionPayload>({
      queryKey,
      queryFn: () => fetchWorkspaceApi<CustomersSectionPayload>("customers"),
    });

  const handleForceRefresh = async () => {
    const fresh = await queryClient.fetchQuery({
      queryKey,
      queryFn: () =>
        fetchWorkspaceApi<CustomersSectionPayload>("customers", { fresh: true }),
      staleTime: 0,
    });
    queryClient.setQueryData(queryKey, fresh);
  };

  const withRefresh =
    <Args extends unknown[]>(fn: (...args: Args) => Promise<void>) =>
    async (...args: Args) => {
      await fn(...args);
      await invalidateWorkspaceCaches(queryClient, "customer");
    };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Credit Accounts & Udhaar Ledger"
        title="Customers & Udhaar Ledger"
        description="Manage repeat walk-ins, school/corporate accounts, outstanding credit, and installment repayments."
        actions={
          <SectionRefreshButton
            onRefresh={handleForceRefresh}
            isFetching={isFetching}
            lastUpdatedAt={dataUpdatedAt}
          />
        }
      />

      {isPending && !data ? (
        <WorkspaceSectionSkeleton cards={3} rows={6} />
      ) : data ? (
        <CustomersManager
          customers={data.customers}
          onCreateCustomer={withRefresh(createCustomerAction)}
          onRecordRepayment={withRefresh(recordRepaymentAction)}
        />
      ) : null}
    </div>
  );
}
