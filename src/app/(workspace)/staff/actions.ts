"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { assertAuthorizedRole } from "@/lib/auth/permissions";
import { dbQuery, dbQueryOne } from "@/lib/db/pool";

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

  const empCode =
    payload.employeeNumber.trim() ||
    `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
  const joinDate = payload.joiningDate || new Date().toISOString().slice(0, 10);

  await dbQuery(
    `INSERT INTO public.employees
       (business_id, full_name, employee_number, employee_code, phone, email, cnic, address,
        emergency_contact, designation, department, joining_date, hire_date, assigned_shift_type,
        salary_type, salary_amount_paisa, notes, employment_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'ACTIVE')`,
    [
      ctx.businessId,
      cleanName,
      empCode,
      empCode,
      payload.phone?.trim() || null,
      payload.email?.trim() || null,
      payload.cnic?.trim() || null,
      payload.address?.trim() || null,
      payload.emergencyContact?.trim() || null,
      payload.designation.trim() || "Staff",
      payload.department?.trim() || "General",
      joinDate,
      joinDate,
      payload.assignedShiftType,
      payload.salaryType,
      Math.max(0, Number(payload.salaryAmountPaisa) || 0),
      payload.notes?.trim() || null,
    ]
  );

  revalidatePath("/employees");
  revalidatePath("/staff");
}

export async function updateEmployeeAction(
  employeeId: string,
  payload: EmployeePayload
) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  assertAuthorizedRole(ctx.role, ["OWNER", "MANAGER"], "manage staff");

  await dbQuery(
    `UPDATE public.employees
     SET full_name = $1, phone = $2, email = $3, cnic = $4, address = $5,
         designation = $6, department = $7, assigned_shift_type = $8,
         salary_type = $9, salary_amount_paisa = $10, notes = $11
     WHERE id = $12 AND business_id = $13`,
    [
      payload.fullName.trim(),
      payload.phone?.trim() || null,
      payload.email?.trim() || null,
      payload.cnic?.trim() || null,
      payload.address?.trim() || null,
      payload.designation.trim(),
      payload.department?.trim() || null,
      payload.assignedShiftType,
      payload.salaryType,
      Math.max(0, Number(payload.salaryAmountPaisa) || 0),
      payload.notes?.trim() || null,
      employeeId,
      ctx.businessId,
    ]
  );

  revalidatePath("/employees");
  revalidatePath("/staff");
}

export async function updateEmployeeStatusAction(
  employeeId: string,
  newStatus: "ACTIVE" | "SUSPENDED" | "DEACTIVATED" | "ARCHIVED"
) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  assertAuthorizedRole(ctx.role, ["OWNER", "MANAGER"], "manage staff");

  await dbQuery(
    `UPDATE public.employees SET employment_status = $1 WHERE id = $2 AND business_id = $3`,
    [newStatus, employeeId, ctx.businessId]
  );

  revalidatePath("/employees");
  revalidatePath("/staff");
}

export async function deleteEmployeeAction(employeeId: string) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  assertAuthorizedRole(ctx.role, ["OWNER", "MANAGER"], "manage staff");

  await dbQuery(
    `DELETE FROM public.employees WHERE id = $1 AND business_id = $2`,
    [employeeId, ctx.businessId]
  );

  revalidatePath("/employees");
  revalidatePath("/staff");
}

export async function checkInEmployeeAction(
  employeeId: string,
  workDate: string
) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  assertAuthorizedRole(ctx.role, ["OWNER", "MANAGER"], "manage staff");

  const now = new Date().toISOString();
  const empData = await dbQueryOne<{ assigned_shift_type: string | null }>(
    `SELECT assigned_shift_type FROM public.employees WHERE id = $1 AND business_id = $2 LIMIT 1`,
    [employeeId, ctx.businessId]
  );
  const shiftWindow = empData?.assigned_shift_type || "MORNING";

  const existing = await dbQueryOne<{ id: string; actual_out: string | null }>(
    `SELECT id, actual_out FROM public.attendance
     WHERE business_id = $1 AND employee_id = $2 AND work_date = $3 LIMIT 1`,
    [ctx.businessId, employeeId, workDate]
  );

  if (existing) {
    if (!existing.actual_out) {
      await dbQuery(
        `UPDATE public.attendance SET actual_out = $1 WHERE id = $2`,
        [now, existing.id]
      );
    } else {
      await dbQuery(
        `UPDATE public.attendance SET actual_out = NULL WHERE id = $1`,
        [existing.id]
      );
    }
  } else {
    await dbQuery(
      `INSERT INTO public.attendance
         (business_id, employee_id, work_date, attendance_date, shift_window, status, scheduled_in, actual_in, scheduled_out)
       VALUES ($1, $2, $3, $3, $4, 'PRESENT', '08:00:00', $5, '16:00:00')`,
      [ctx.businessId, employeeId, workDate, shiftWindow, now]
    );
  }

  revalidatePath("/employees");
  revalidatePath("/staff");
}

export async function createLeaveRequestAction(payload: LeaveRequestPayload) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  assertAuthorizedRole(ctx.role, ["OWNER", "MANAGER"], "manage staff");

  await dbQuery(
    `INSERT INTO public.leaves (business_id, employee_id, leave_type, start_date, end_date, reason, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')`,
    [
      ctx.businessId,
      payload.employeeId,
      payload.leaveType,
      payload.startDate,
      payload.endDate,
      payload.reason.trim(),
    ]
  );

  revalidatePath("/employees");
  revalidatePath("/staff");
}

export async function updateLeaveStatusAction(
  leaveId: string,
  status: "APPROVED" | "REJECTED" | "CANCELLED"
) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  assertAuthorizedRole(ctx.role, ["OWNER", "MANAGER"], "manage staff");

  await dbQuery(
    `UPDATE public.leaves SET status = $1, approved_by = $2 WHERE id = $3 AND business_id = $4`,
    [status, ctx.userId, leaveId, ctx.businessId]
  );

  revalidatePath("/employees");
  revalidatePath("/staff");
}
