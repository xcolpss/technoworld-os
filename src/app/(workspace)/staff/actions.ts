"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { assertAuthorizedRole } from "@/lib/auth/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface EmployeePayload {
  fullName: string;
  employeeNumber: string;
  phone?: string;
  email?: string;
  cnic?: string;
  address?: string;
  emergencyContact?: string;
  designation: string;
  department?: string;
  joiningDate: string;
  assignedShiftType: "MORNING" | "EVENING" | "CUSTOM" | "ROTATING";
  salaryType: "MONTHLY" | "DAILY" | "HOURLY" | "CUSTOM";
  salaryAmountPaisa: number;
  notes?: string;
}

export interface LeaveRequestPayload {
  employeeId: string;
  leaveType: "CASUAL" | "SICK" | "EMERGENCY" | "UNPAID" | "OTHER";
  startDate: string;
  endDate: string;
  reason: string;
}

export async function createEmployeeAction(payload: EmployeePayload) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  assertAuthorizedRole(ctx.role, ["OWNER", "MANAGER"], "manage staff");

  const cleanName = String(payload.fullName || "").trim();
  if (!cleanName) throw new Error("Employee full name is required.");

  const empCode = payload.employeeNumber.trim() || `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
  const joinDate = payload.joiningDate || new Date().toISOString().slice(0, 10);
  const admin = createSupabaseAdminClient();

  const { error } = await admin.from("employees").insert({
    business_id: ctx.businessId,
    full_name: cleanName,
    employee_number: empCode,
    employee_code: empCode,
    phone: payload.phone?.trim() || null,
    email: payload.email?.trim() || null,
    cnic: payload.cnic?.trim() || null,
    address: payload.address?.trim() || null,
    emergency_contact: payload.emergencyContact?.trim() || null,
    designation: payload.designation.trim() || "Staff",
    department: payload.department?.trim() || "General",
    joining_date: joinDate,
    hire_date: joinDate,
    assigned_shift_type: payload.assignedShiftType,
    salary_type: payload.salaryType,
    salary_amount_paisa: Math.max(0, Number(payload.salaryAmountPaisa) || 0),
    notes: payload.notes?.trim() || null,
    employment_status: "ACTIVE",
  });

  if (error) throw new Error(`Failed to create employee: ${error.message}`);
  revalidatePath("/employees");
}

export async function updateEmployeeAction(employeeId: string, payload: EmployeePayload) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  assertAuthorizedRole(ctx.role, ["OWNER", "MANAGER"], "manage staff");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("employees")
    .update({
      full_name: payload.fullName.trim(),
      phone: payload.phone?.trim() || null,
      email: payload.email?.trim() || null,
      cnic: payload.cnic?.trim() || null,
      address: payload.address?.trim() || null,
      designation: payload.designation.trim(),
      department: payload.department?.trim() || null,
      assigned_shift_type: payload.assignedShiftType,
      salary_type: payload.salaryType,
      salary_amount_paisa: Math.max(0, Number(payload.salaryAmountPaisa) || 0),
      notes: payload.notes?.trim() || null,
    })
    .eq("id", employeeId)
    .eq("business_id", ctx.businessId);

  if (error) throw new Error(`Failed to update employee: ${error.message}`);
  revalidatePath("/employees");
}

export async function updateEmployeeStatusAction(employeeId: string, newStatus: "ACTIVE" | "SUSPENDED" | "DEACTIVATED" | "ARCHIVED") {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  assertAuthorizedRole(ctx.role, ["OWNER", "MANAGER"], "manage staff");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("employees")
    .update({ employment_status: newStatus })
    .eq("id", employeeId)
    .eq("business_id", ctx.businessId);

  if (error) throw new Error(`Failed to update status: ${error.message}`);
  revalidatePath("/employees");
}

export async function deleteEmployeeAction(employeeId: string) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  assertAuthorizedRole(ctx.role, ["OWNER", "MANAGER"], "manage staff");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("employees")
    .delete()
    .eq("id", employeeId)
    .eq("business_id", ctx.businessId);

  if (error) throw new Error(`Failed to delete employee: ${error.message}`);
  revalidatePath("/employees");
}

export async function checkInEmployeeAction(employeeId: string, workDate: string) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  assertAuthorizedRole(ctx.role, ["OWNER", "MANAGER"], "manage staff");

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  // Fetch employee shift type
  const { data: empData } = await admin
    .from("employees")
    .select("assigned_shift_type")
    .eq("id", employeeId)
    .maybeSingle();

  const shiftWindow = empData?.assigned_shift_type || "MORNING";

  const { data: existing, error: fetchError } = await admin
    .from("attendance")
    .select("id, actual_out")
    .eq("business_id", ctx.businessId)
    .eq("employee_id", employeeId)
    .eq("work_date", workDate)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to fetch attendance: ${fetchError.message}`);
  }

  if (existing) {
    if (!existing.actual_out) {
      // Record exact check-out time (when they left)
      const { error: updateError } = await admin
        .from("attendance")
        .update({ actual_out: now })
        .eq("id", existing.id);
      if (updateError) throw new Error(`Failed to check out: ${updateError.message}`);
    } else {
      // Reset check-out if toggled again
      const { error: updateError } = await admin
        .from("attendance")
        .update({ actual_out: null })
        .eq("id", existing.id);
      if (updateError) throw new Error(`Failed to reset check-out: ${updateError.message}`);
    }
  } else {
    // Record exact check-in time (when they came) and shift window
    const { error: insertError } = await admin.from("attendance").insert({
      business_id: ctx.businessId,
      employee_id: employeeId,
      work_date: workDate,
      attendance_date: workDate,
      shift_window: shiftWindow,
      status: "PRESENT",
      scheduled_in: "08:00:00",
      actual_in: now,
      scheduled_out: "16:00:00",
    });
    if (insertError) throw new Error(`Failed to check in: ${insertError.message}`);
  }

  revalidatePath("/employees");
}

export async function createLeaveRequestAction(payload: LeaveRequestPayload) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  assertAuthorizedRole(ctx.role, ["OWNER", "MANAGER"], "manage staff");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("leaves").insert({
    business_id: ctx.businessId,
    employee_id: payload.employeeId,
    leave_type: payload.leaveType,
    start_date: payload.startDate,
    end_date: payload.endDate,
    reason: payload.reason.trim(),
    status: "PENDING",
  });

  if (error) throw new Error(`Failed to submit leave request: ${error.message}`);
  revalidatePath("/employees");
}

export async function updateLeaveStatusAction(leaveId: string, status: "APPROVED" | "REJECTED" | "CANCELLED") {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  assertAuthorizedRole(ctx.role, ["OWNER", "MANAGER"], "manage staff");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("leaves")
    .update({ status, approved_by: ctx.userId })
    .eq("id", leaveId)
    .eq("business_id", ctx.businessId);

  if (error) throw new Error(`Failed to update leave status: ${error.message}`);
  revalidatePath("/employees");
}