import { Suspense } from "react";
import { EmployeesCachedView } from "@/components/workspace/employees-cached-view";
import { WorkspaceSectionSkeleton } from "@/components/ui/workspace-skeleton";

export default function StaffPage() {
  return (
    <Suspense fallback={<WorkspaceSectionSkeleton cards={4} rows={7} />}>
      <EmployeesCachedView mode="staff" />
    </Suspense>
  );
}
