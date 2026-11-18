import { Suspense } from "react";
import { ClosingCachedView } from "@/components/dashboard/closing-cached-view";
import { WorkspaceSectionSkeleton } from "@/components/ui/workspace-skeleton";

export default function DailyClosingPage() {
  return (
    <Suspense fallback={<WorkspaceSectionSkeleton cards={4} rows={6} />}>
      <ClosingCachedView />
    </Suspense>
  );
}
