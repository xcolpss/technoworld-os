import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { StaffManager, type EmployeeRecord, type AttendanceRecord, type LeaveRecord } from "@/components/staff/staff-manager";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createEmployeeAction,
  updateEmployeeAction,
  deleteEmployeeAction,
  checkInEmployeeAction,
  createLeaveRequestAction,
  updateLeaveStatusAction,
} from "@/app/(workspace)/staff/actions";

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const params = await searchParams;
  const admin = createSupabaseAdminClient();

  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const selectedDate = params.date || todayStr;

  const [{ data: rawEmployees }, { data: rawAttendance }, { data: rawLeaves }] = await Promise.all([
    admin.from("employees").select("*").eq("business_id", ctx.businessId).order("full_name", { ascending: true }),
    admin.from("attendance").select("*").eq("business_id", ctx.businessId).eq("work_date", selectedDate),
    admin.from("leaves").select("*, employees ( full_name )").eq("business_id", ctx.businessId).order("created_at", { ascending: false }),
  ]);

  const attendanceMap = new Map<string, { actualIn: string | null; actualOut: string | null; shiftWindow: string }>();
  const checkedInIds = new Set<string>();

  for (const att of (rawAttendance ?? []) as Array<Record<string, unknown>>) {
    const empId = String(att.employee_id);
    const actualIn = att.actual_in ? String(att.actual_in) : null;
    const actualOut = att.actual_out ? String(att.actual_out) : null;
    const shiftWindow = String(att.shift_window ?? "MORNING");

    attendanceMap.set(empId, { actualIn, actualOut, shiftWindow });
    if (actualIn && !actualOut) {
      checkedInIds.add(empId);
    }
  }

  const employees: EmployeeRecord[] = (rawEmployees ?? []).map((e: Record<string, unknown>) => {
    const id = String(e.id);
    const att = attendanceMap.get(id);
    return {
      id,
      employee_number: String(e.employee_number ?? "EMP-000"),
      full_name: String(e.full_name ?? ""),
      phone: e.phone ? String(e.phone) : null,
      designation: String(e.designation ?? "Staff"),
      department: e.department ? String(e.department) : null,
      employment_status: String(e.employment_status ?? "ACTIVE"),
      assigned_shift_type: String(e.assigned_shift_type ?? "MORNING"),
      salary_type: String(e.salary_type ?? "MONTHLY"),
      salary_amount_paisa: Number(e.salary_amount_paisa ?? 0),
      joining_date: String(e.joining_date ?? todayStr),
      isCheckedInToday: checkedInIds.has(id),
      actualInToday: att?.actualIn ?? null,
      actualOutToday: att?.actualOut ?? null,
    };
  });

  const attendanceRecords: AttendanceRecord[] = (rawEmployees ?? []).map((e: Record<string, unknown>) => {
    const id = String(e.id);
    const att = attendanceMap.get(id);
    return {
      employeeId: id,
      employeeName: String(e.full_name ?? ""),
      employeeNumber: String(e.employee_number ?? ""),
      designation: String(e.designation ?? ""),
      shiftWindow: att?.shiftWindow || String(e.assigned_shift_type ?? "MORNING"),
      actualIn: att?.actualIn || null,
      actualOut: att?.actualOut || null,
    };
  });

  const leaves: LeaveRecord[] = (rawLeaves ?? []).map((l: Record<string, unknown>) => {
    const empObj = Array.isArray(l.leaves) ? l.leaves[0] : l.employees;
    const empRec = (Array.isArray(l.employees) ? l.employees[0] : l.employees ?? {}) as Record<string, unknown>;
    return {
      id: String(l.id),
      employeeName: String(empRec.full_name ?? "Staff"),
      leaveType: String(l.leave_type ?? "CASUAL"),
      startDate: String(l.start_date ?? todayStr),
      endDate: String(l.end_date ?? todayStr),
      reason: String(l.reason ?? ""),
      status: String(l.status ?? "PENDING"),
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
        attendanceRecords={attendanceRecords}
        leaves={leaves}
        todayStr={todayStr}
        selectedDate={selectedDate}
        onCreateEmployee={createEmployeeAction}
        onUpdateEmployee={updateEmployeeAction}
        onDeleteEmployee={deleteEmployeeAction}
        onCheckIn={checkInEmployeeAction}
        onCreateLeave={createLeaveRequestAction}
        onUpdateLeave={updateLeaveStatusAction}
      />
    </div>
  );
}