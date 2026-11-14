import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { StaffManager, type EmployeeRecord, type LeaveRecord } from "@/components/staff/staff-manager";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createEmployeeAction, checkInEmployeeAction, updateLeaveStatusAction, updateEmployeeStatusAction } from "./actions";

export default async function StaffPage() {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const admin = createSupabaseAdminClient();

  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const [{ data: rawEmployees }, { data: rawAttendance }, { data: rawLeaves }] = await Promise.all([
    admin.from("employees").select("*").eq("business_id", ctx.businessId).order("full_name", { ascending: true }),
    admin.from("attendance").select("*").eq("business_id", ctx.businessId).eq("work_date", todayStr),
    admin.from("leaves").select("*, employees ( full_name )").eq("business_id", ctx.businessId).order("created_at", { ascending: false }),
  ]);

  const checkedInIds = new Set<string>();
  for (const att of (rawAttendance ?? []) as Array<Record<string, unknown>>) {
    if (att.actual_in && !att.actual_out) {
      checkedInIds.add(String(att.employee_id));
    }
  }

  const employees: EmployeeRecord[] = (rawEmployees ?? []).map((e: Record<string, unknown>) => {
    const id = String(e.id);
          return {
        id,
        employee_number: String(e.employee_number || ''),
        full_name: String(e.full_name || ''),
        phone: e.phone ? String(e.phone) : null,
        designation: String(e.designation || 'Staff'),
        department: e.department ? String(e.department) : null,
        employment_status: e.employment_status,
        assigned_shift_type: String(e.assigned_shift_type || 'Morning'),
        salary_type: String(e.salary_type || 'Daily'),
        salary_amount_paisa: Number(e.salary_amount_paisa || 0),
        joining_date: String(e.joining_date || new Date().toISOString().split('T')[0]),
        isCheckedInToday: Boolean(e.isCheckedInToday),
        actualInToday: (e.actualInToday as string) || null,
        actualOutToday: (e.actualOutToday as string) || null,
      };;
  });

  const leaves: LeaveRecord[] = (rawLeaves ?? []).map((l: Record<string, unknown>) => {
    const empObj = Array.isArray(l.employees) ? l.employees[0] : l.employees;
    const empRec = (empObj ?? {}) as Record<string, unknown>;
    return {
      id: String(l.id),
      employeeName: String(empRec.full_name ?? "Staff"),
      leaveType: String(l.leave_type ?? "CASUAL"),
      startDate: String(l.start_date ?? todayStr),
      endDate: String(l.end_date ?? todayStr),
      reason: String(l.reason ?? ""),
      status: (l.status ?? "PENDING") as any,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workforce Control & HR Center"
        title="Staff Management & Payroll"
        description="Manage employee directory, check-ins, shift schedules, leave requests, advances, and salary payroll."
      />

      <StaffManager
        employees={employees}
        leaves={leaves}
        todayStr={todayStr}
        onCreateEmployee={createEmployeeAction}
        onCheckIn={checkInEmployeeAction}
        onUpdateLeave={updateLeaveStatusAction}
        onUpdateStatus={updateEmployeeStatusAction}
      />
    </div>
  );
}