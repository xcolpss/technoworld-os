"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { SectionRefreshButton } from "@/components/ui/section-refresh-button";
import { WorkspaceSectionSkeleton } from "@/components/ui/workspace-skeleton";
import { AccessRestricted } from "@/components/auth/access-restricted";
import { hasRequiredRole } from "@/lib/auth/permissions";
import { useWorkspaceUser } from "@/lib/workspace/context";
import {
  StaffManager,
  type AttendanceRecord,
  type EmployeeRecord,
  type LeaveRecord,
} from "@/components/staff/staff-manager";
import {
  checkInEmployeeAction,
  createEmployeeAction,
  createLeaveRequestAction,
  deleteEmployeeAction,
  updateEmployeeAction,
  updateEmployeeStatusAction,
  updateLeaveStatusAction,
} from "@/app/(workspace)/staff/actions";
import {
  fetchWorkspaceApi,
  invalidateWorkspaceCaches,
  workspaceQueryKeys,
} from "@/lib/query/cache-keys";

interface EmployeesSectionPayload {
  employees: EmployeeRecord[];
  attendanceRecords: AttendanceRecord[];
  leaves: LeaveRecord[];
  todayStr: string;
  selectedDate: string;
}

export function EmployeesCachedView({
  mode = "employees",
}: {
  mode?: "employees" | "staff";
}) {
  const user = useWorkspaceUser();
  const sp = useSearchParams();
  const allowed = hasRequiredRole(user.role, ["OWNER", "MANAGER"]);
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = React.useState<string>(
    sp.get("date") || ""
  );

  const queryKey = workspaceQueryKeys.employees(selectedDate || undefined);
  const apiPath = selectedDate
    ? `employees?date=${encodeURIComponent(selectedDate)}`
    : "employees";

  const { data, isPending, isFetching, dataUpdatedAt } =
    useQuery<EmployeesSectionPayload>({
      queryKey,
      queryFn: () => fetchWorkspaceApi<EmployeesSectionPayload>(apiPath),
      placeholderData: keepPreviousData,
      enabled: allowed,
    });

  if (!allowed) {
    return (
      <AccessRestricted
        currentRole={user.role}
        requiredRoles={["OWNER", "MANAGER"]}
        sectionName={mode === "staff" ? "Staff Management" : "Employees & Attendance"}
      />
    );
  }

  const handleForceRefresh = async () => {
    const fresh = await queryClient.fetchQuery({
      queryKey,
      queryFn: () => fetchWorkspaceApi<EmployeesSectionPayload>(apiPath, { fresh: true }),
      staleTime: 0,
    });
    queryClient.setQueryData(queryKey, fresh);
  };

  const handleDateChange = (nextDate: string) => {
    setSelectedDate(nextDate);
    if (typeof window !== "undefined" && mode === "employees") {
      window.history.replaceState(null, "", `/employees?date=${encodeURIComponent(nextDate)}`);
    }
  };

  const withRefresh =
    <Args extends unknown[]>(fn: (...args: Args) => Promise<void>) =>
    async (...args: Args) => {
      await fn(...args);
      await invalidateWorkspaceCaches(queryClient, "employee");
    };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workforce Control & HR Center"
        title={mode === "staff" ? "Staff Management & Payroll" : "Employees, Attendance & HR"}
        description="Manage employee directory, daily check-ins, shift assignments, leave requests, and salary payroll."
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
        <StaffManager
          employees={data.employees}
          attendanceRecords={data.attendanceRecords}
          leaves={data.leaves}
          todayStr={data.todayStr}
          selectedDate={data.selectedDate}
          onDateChange={handleDateChange}
          onMutated={() => invalidateWorkspaceCaches(queryClient, "employee")}
          onCreateEmployee={withRefresh(createEmployeeAction)}
          onUpdateEmployee={withRefresh(updateEmployeeAction)}
          onDeleteEmployee={withRefresh(deleteEmployeeAction)}
          onCheckIn={withRefresh(checkInEmployeeAction)}
          onCreateLeave={withRefresh(createLeaveRequestAction)}
          onUpdateLeave={withRefresh(updateLeaveStatusAction)}
          onUpdateStatus={withRefresh(updateEmployeeStatusAction)}
        />
      ) : null}
    </div>
  );
}
