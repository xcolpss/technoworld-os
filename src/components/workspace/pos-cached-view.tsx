"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { SectionRefreshButton } from "@/components/ui/section-refresh-button";
import { WorkspaceSectionSkeleton } from "@/components/ui/workspace-skeleton";
import {
  PosCounter,
  type PosCategoryRecord,
  type PosProductItem,
  type PrintPaperRecord,
  type MediaCatRecord,
  type ComposingServiceRecord,
} from "@/components/pos/pos-counter";
import {
  completePosSaleAction,
  createPrintPaperAction,
  updatePrintPaperAction,
  deletePrintPaperAction,
  createMediaCategoryAction,
  updateMediaCategoryAction,
  deleteMediaCategoryAction,
  createComposingServiceAction,
  updateComposingServiceAction,
  deleteComposingServiceAction,
  type CompleteSalePayload,
} from "@/app/(workspace)/pos/actions";
import {
  fetchWorkspaceApi,
  invalidateWorkspaceCaches,
  workspaceQueryKeys,
} from "@/lib/query/cache-keys";

interface PosSectionPayload {
  categories: PosCategoryRecord[];
  products: PosProductItem[];
  printPapers: PrintPaperRecord[];
  mediaCategories: MediaCatRecord[];
  composingServices: ComposingServiceRecord[];
}

export function PosCachedView() {
  const queryClient = useQueryClient();
  const queryKey = workspaceQueryKeys.pos();

  const { data, isPending, isFetching, dataUpdatedAt } =
    useQuery<PosSectionPayload>({
      queryKey,
      queryFn: () => fetchWorkspaceApi<PosSectionPayload>("pos"),
    });

  const handleForceRefresh = async () => {
    const fresh = await queryClient.fetchQuery({
      queryKey,
      queryFn: () => fetchWorkspaceApi<PosSectionPayload>("pos", { fresh: true }),
      staleTime: 0,
    });
    queryClient.setQueryData(queryKey, fresh);
  };

  const handleCompleteSale = async (payload: CompleteSalePayload) => {
    const res = await completePosSaleAction(payload);
    await invalidateWorkspaceCaches(queryClient, "sale");
    return res;
  };

  const withCatalogRefresh =
    <Args extends unknown[], R>(fn: (...args: Args) => Promise<R>) =>
    async (...args: Args): Promise<R> => {
      const res = await fn(...args);
      await invalidateWorkspaceCaches(queryClient, "pos-catalog");
      return res;
    };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fast Counter Checkout"
        title="POS Counter"
        description="Unified live retail checkout with inventory sync, printing calculator, media copies, and composing services visible upfront."
        actions={
          <SectionRefreshButton
            onRefresh={handleForceRefresh}
            isFetching={isFetching}
            lastUpdatedAt={dataUpdatedAt}
          />
        }
      />

      {isPending && !data ? (
        <WorkspaceSectionSkeleton cards={0} rows={7} />
      ) : data ? (
        <PosCounter
          categories={data.categories}
          products={data.products}
          printPapers={data.printPapers}
          mediaCategories={data.mediaCategories}
          composingServices={data.composingServices}
          onCompleteSale={handleCompleteSale}
          onCreatePaper={withCatalogRefresh(createPrintPaperAction)}
          onUpdatePaper={withCatalogRefresh(updatePrintPaperAction)}
          onDeletePaper={withCatalogRefresh(deletePrintPaperAction)}
          onCreateMediaCat={withCatalogRefresh(createMediaCategoryAction)}
          onUpdateMediaCat={withCatalogRefresh(updateMediaCategoryAction)}
          onDeleteMediaCat={withCatalogRefresh(deleteMediaCategoryAction)}
          onCreateComposing={withCatalogRefresh(createComposingServiceAction)}
          onUpdateComposing={withCatalogRefresh(updateComposingServiceAction)}
          onDeleteComposing={withCatalogRefresh(deleteComposingServiceAction)}
        />
      ) : null}
    </div>
  );
}
