import { Suspense } from "react";
import { DashboardCachedView } from "@/components/dashboard/dashboard-cached-view";
import { WorkspaceSectionSkeleton } from "@/components/ui/workspace-skeleton";

export default function DashboardPage() {
  return (
    <Suspense fallback={<WorkspaceSectionSkeleton cards={4} rows={7} />}>
      <DashboardCachedView />
    </Suspense>
  );
}
