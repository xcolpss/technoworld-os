import { Suspense } from "react";
import { FinanceCachedView } from "@/components/workspace/finance-cached-view";
import { WorkspaceSectionSkeleton } from "@/components/ui/workspace-skeleton";

export default function FinancePage() {
  return (
    <Suspense fallback={<WorkspaceSectionSkeleton cards={4} rows={6} />}>
      <FinanceCachedView />
    </Suspense>
  );
}
