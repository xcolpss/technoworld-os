"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Edit,
  Filter,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { formatPkr, pkrToPaisa } from "@/lib/format/currency";
import type { EmployeePayload, LeaveRequestPayload } from "@/app/(workspace)/staff/actions";

export interface EmployeeRecord {
  id: string;
  employee_number: string;
  full_name: string;
  phone: string | null;
  designation: string;
  department: string | null;
  employment_status: string;
  assigned_shift_type: string;
  salary_type: string;
  salary_amount_paisa: number;
  joining_date: string;
  isCheckedInToday: boolean;
  actualInToday: string | null;
  actualOutToday: string | null;
}

export interface AttendanceRecord {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  designation: string;
  shiftWindow: string;
  actualIn: string | null;
  actualOut: string | null;
}

export interface LeaveRecord {
  id: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
}

interface StaffManagerProps {
  employees: EmployeeRecord[];
  attendanceRecords: AttendanceRecord[];
  leaves: LeaveRecord[];
  todayStr: string;
  selectedDate: string;
  onCreateEmployee: (payload: EmployeePayload) => Promise<void>;
  onUpdateEmployee: (id: string, payload: EmployeePayload) => Promise<void>;
  onDeleteEmployee: (id: string) => Promise<void>;
  onCheckIn: (employeeId: string, workDate: string) => Promise<void>;
  onCreateLeave: (payload: LeaveRequestPayload) => Promise<void>;
  onUpdateLeave: (leaveId: string, status: "APPROVED" | "REJECTED" | "CANCELLED") => Promise<void>;
}

export function StaffManager({
  employees,
  attendanceRecords,
  leaves,
  todayStr,
  selectedDate,
  onCreateEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onCheckIn,
  onCreateLeave,
  onUpdateLeave,
}: StaffManagerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<"DIRECTORY" | "ATTENDANCE" | "LEAVES" | "PAYROLL">("ATTENDANCE");
  const [search, setSearch] = React.useState("");
  const [filterDate, setFilterDate] = React.useState(selectedDate);

  // Modals
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [editingEmployee, setEditingEmployee] = React.useState<EmployeeRecord | null>(null);
  const [showLeaveModal, setShowLeaveModal] = React.useState(false);
  const [selectedPayslipEmp, setSelectedPayslipEmp] = React.useState<EmployeeRecord | null>(null);

  // Form States
  const [fullName, setFullName] = React.useState("");
  const [empNum, setEmpNum] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [designation, setDesignation] = React.useState("Staff / Cashier");
  const [department, setDepartment] = React.useState("POS Operations");
  const [shiftType, setShiftType] = React.useState<any>("MORNING");
  const [salaryType, setSalaryType] = React.useState<any>("MONTHLY");
  const [salaryPkr, setSalaryPkr] = React.useState("35000");

  // Leave Form State
  const [leaveEmpId, setLeaveEmpId] = React.useState(employees[0]?.id || "");
  const [leaveType, setLeaveType] = React.useState<any>("CASUAL");
  const [startDate, setStartDate] = React.useState(todayStr);
  const [endDate, setEndDate] = React.useState(todayStr);
  const [leaveReason, setLeaveReason] = React.useState("");

  const [feedback, setFeedback] = React.useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const activeEmployees = employees.filter((e) => e.employment_status === "ACTIVE");
  const checkedInCount = activeEmployees.filter((e) => e.isCheckedInToday).length;
  const pendingLeaves = leaves.filter((l) => l.status === "PENDING");

  const filteredEmployees = employees.filter((e) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!e.full_name.toLowerCase().includes(q) && !e.employee_number.toLowerCase().includes(q) && !e.designation.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newDate = e.target.value;
    setFilterDate(newDate);
    router.push(`/employees?date=${newDate}`);
  }

  function formatTime(isoString: string | null) {
    if (!isoString) return "â€”";
    try {
      return new Date(isoString).toLocaleTimeString("en-US", {
        timeZone: "Asia/Karachi",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return isoString;
    }
  }

  function openAddModal() {
    setFullName("");
    setEmpNum(`EMP-${Math.floor(1000 + Math.random() * 9000)}`);
    setPhone("");
    setDesignation("Staff / Cashier");
    setDepartment("POS Operations");
    setShiftType("MORNING");
    setSalaryType("MONTHLY");
    setSalaryPkr("35000");
    setEditingEmployee(null);
    setShowAddModal(true);
  }

  function openEditModal(emp: EmployeeRecord) {
    setEditingEmployee(emp);
    setFullName(emp.full_name);
    setEmpNum(emp.employee_number);
    setPhone(emp.phone || "");
    setDesignation(emp.designation);
    setDepartment(emp.department || "POS Operations");
    setShiftType(emp.assigned_shift_type);
    setSalaryType(emp.salary_type);
    setSalaryPkr(Math.round(emp.salary_amount_paisa / 100).toString());
    setShowAddModal(true);
  }

  function handleSaveEmployee(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      try {
        const payload: EmployeePayload = {
          fullName,
          employeeNumber: empNum,
          phone,
          designation,
          department,
          joiningDate: todayStr,
          assignedShiftType: shiftType,
          salaryType,
          salaryAmountPaisa: pkrToPaisa(salaryPkr),
        };

        if (editingEmployee) {
          await onUpdateEmployee(editingEmployee.id, payload);
          setFeedback({ type: "ok", text: "Employee updated successfully!" });
        } else {
          await onCreateEmployee(payload);
          setFeedback({ type: "ok", text: "Employee added successfully!" });
        }
        setShowAddModal(false);
      } catch (err) {
        setFeedback({ type: "err", text: err instanceof Error ? err.message : "Failed to save employee." });
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this employee?")) return;
    startTransition(async () => {
      try {
        await onDeleteEmployee(id);
        setFeedback({ type: "ok", text: "Employee removed successfully." });
      } catch (err) {
        setFeedback({ type: "err", text: err instanceof Error ? err.message : "Failed to delete employee." });
      }
    });
  }

  function handleCheckInClick(empId: string) {
    startTransition(async () => {
      try {
        await onCheckIn(empId, selectedDate);
        setFeedback({ type: "ok", text: "Attendance updated successfully!" });
        router.refresh();
      } catch (err) {
        setFeedback({ type: "err", text: err instanceof Error ? err.message : "Failed to record check-in." });
      }
    });
  }

  function handleLeaveSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await onCreateLeave({
          employeeId: leaveEmpId || activeEmployees[0]?.id,
          leaveType,
          startDate,
          endDate,
          reason: leaveReason,
        });
        setShowLeaveModal(false);
        setLeaveReason("");
        setFeedback({ type: "ok", text: "Leave request submitted successfully!" });
      } catch (err) {
        setFeedback({ type: "err", text: err instanceof Error ? err.message : "Failed to submit leave request." });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Top Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-brand/30 bg-brand-soft/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted">Active Staff</span>
              <Users className="h-4 w-4 text-brand" />
            </div>
            <p className="mt-1 font-mono text-xl font-extrabold text-ink">{activeEmployees.length}</p>
            <p className="mt-0.5 text-[10px] text-muted">Total employed</p>
          </CardContent>
        </Card>

        <Card className="border-success/30 bg-success-soft/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-success">Checked In Today</span>
              <UserCheck className="h-4 w-4 text-success" />
            </div>
            <p className="mt-1 font-mono text-xl font-extrabold text-success">{checkedInCount}</p>
            <p className="mt-0.5 text-[10px] text-muted">Active attendance</p>
          </CardContent>
        </Card>

        <Card className="border-warning/30 bg-warning-soft/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-warning">Pending Leaves</span>
              <Clock className="h-4 w-4 text-warning" />
            </div>
            <p className="mt-1 font-mono text-xl font-extrabold text-warning">{pendingLeaves.length}</p>
            <p className="mt-0.5 text-[10px] text-muted">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card className="flex items-center justify-between p-4">
          <div>
            <span className="text-xs font-bold text-muted">New Hire</span>
            <p className="text-sm font-bold text-ink">Add Employee</p>
          </div>
          <Button type="button" size="sm" onClick={openAddModal}>
            <UserPlus className="h-4 w-4" />
            Hire Staff
          </Button>
        </Card>
      </div>

      {feedback && (
        <div className={`rounded-2xl px-4 py-3 text-xs font-semibold ${feedback.type === "ok" ? "bg-success-soft text-success border border-success/30" : "bg-danger-soft text-danger border border-danger/30"}`}>
          {feedback.text}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex rounded-2xl border border-border bg-surface p-1.5 shadow-xs">
        {(
          [
            { id: "DIRECTORY", label: "Employee Directory" },
            { id: "ATTENDANCE", label: "Attendance & Check-in" },
            { id: "LEAVES", label: "Leave Requests" },
            { id: "PAYROLL", label: "Salary & Payroll" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 rounded-xl py-2 text-xs font-extrabold transition ${activeTab === t.id ? "bg-brand text-white shadow-xs" : "text-muted hover:text-ink"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: EMPLOYEE DIRECTORY */}
      {activeTab === "DIRECTORY" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, ID or designation..."
                className="h-9 pl-8 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEmployees.map((emp) => (
              <Card key={emp.id} className="hover:border-brand/40 transition">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-[10px] text-muted">{emp.employee_number}</span>
                      <h3 className="font-display text-sm font-extrabold text-ink">{emp.full_name}</h3>
                    </div>
                    <Badge variant={emp.employment_status === "ACTIVE" ? "success" : "danger"}>
                      {emp.employment_status}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-xs text-muted">
                    <p>Designation: <strong className="text-ink">{emp.designation}</strong></p>
                    <p>Shift: <strong className="text-ink">{emp.assigned_shift_type}</strong></p>
                    <p>Salary: <strong className="font-mono text-brand-dark">{formatPkr(emp.salary_amount_paisa)} / {emp.salary_type.toLowerCase()}</strong></p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                    <Button type="button" size="sm"  className="h-7 text-xs" onClick={() => openEditModal(emp)}>
                      <Edit className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-danger hover:bg-danger-soft" onClick={() => handleDelete(emp.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: ATTENDANCE & CHECK-IN */}
      {activeTab === "ATTENDANCE" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-extrabold text-ink">Attendance Log &amp; Check-In History</h3>
              <p className="text-xs text-muted">Select any date to view exact arrival and departure times or record attendance.</p>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs font-bold text-muted flex items-center gap-1">
                <Filter className="h-3.5 w-3.5 text-brand" /> Date Filter:
              </Label>
              <Input
                type="date"
                value={filterDate}
                onChange={handleDateChange}
                className="h-9 w-auto text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            {attendanceRecords.map((att) => {
              const emp = employees.find((e) => e.id === att.employeeId);
              const isCheckedIn = Boolean(att.actualIn && !att.actualOut);

              return (
                <Card key={att.employeeId}>
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink text-sm">{att.employeeName}</span>
                        <span className="font-mono text-[10px] text-muted">({att.employeeNumber})</span>
                        <Badge variant={isCheckedIn || att.actualOut ? "success" : "warning"}>
                          {isCheckedIn ? "Checked In" : att.actualOut ? "Shift Completed" : "Not Checked In"}
                        </Badge>
                      </div>
                      <p className="text-muted">{att.designation} â€¢ Shift Window: <strong className="text-ink">{att.shiftWindow}</strong></p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right space-y-0.5">
                        <p className="text-[10px] text-muted uppercase tracking-wider">Exact Arrival (In)</p>
                        <p className="font-mono font-bold text-success">{formatTime(att.actualIn)}</p>
                      </div>
                      <div className="text-right space-y-0.5">
                        <p className="text-[10px] text-muted uppercase tracking-wider">Exact Departure (Out)</p>
                        <p className="font-mono font-bold text-brand-dark">{formatTime(att.actualOut)}</p>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant={isCheckedIn ? "secondary" : "default"}
                        onClick={() => handleCheckInClick(att.employeeId)}
                        disabled={isPending}
                        className="ml-2"
                      >
                        {isCheckedIn ? "Check Out" : att.actualOut ? "Re-Check In" : "Check In"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: LEAVE MANAGEMENT */}
      {activeTab === "LEAVES" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-extrabold text-ink">Leave Requests ({leaves.length})</h3>
            <Button type="button" size="sm" onClick={() => setShowLeaveModal(true)}>
              <Plus className="h-4 w-4 mr-1" /> Request Leave
            </Button>
          </div>

          {leaves.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-xs text-muted">No leave requests recorded.</CardContent>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {leaves.map((l) => (
                <Card key={l.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink">{l.employeeName}</span>
                        <Badge variant={l.status === "APPROVED" ? "success" : l.status === "REJECTED" ? "danger" : "warning"}>
                          {l.status}
                        </Badge>
                      </div>
                      <p className="text-muted">Type: {l.leaveType} â€¢ From {l.startDate} to {l.endDate}</p>
                      <p className="text-ink italic">"{l.reason}"</p>
                    </div>

                    {l.status === "PENDING" && (
                      <div className="flex items-center gap-2">
                        <Button type="button" size="sm"  onClick={() => startTransition(async () => await onUpdateLeave(l.id, "APPROVED"))}>
                          Approve
                        </Button>
                        <Button type="button" size="sm" variant="ghost" className="text-danger" onClick={() => startTransition(async () => await onUpdateLeave(l.id, "REJECTED"))}>
                          Reject
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PAYROLL */}
      {activeTab === "PAYROLL" && (
        <div className="space-y-4">
          <h3 className="font-display text-sm font-extrabold text-ink">Employee Salaries &amp; Payslip Generator</h3>

          <div className="space-y-2">
            {activeEmployees.map((emp) => (
              <Card key={emp.id}>
                <CardContent className="p-4 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-ink">{emp.full_name} ({emp.employee_number})</p>
                    <p className="text-muted">Structure: {emp.salary_type} â€¢ Salary: <strong className="font-mono text-brand-dark">{formatPkr(emp.salary_amount_paisa)}</strong></p>
                  </div>
                  <Button type="button" size="sm"  onClick={() => setSelectedPayslipEmp(emp)}>
                    Generate Payslip
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: Add / Edit Employee */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-4">
            <h3 className="font-display text-base font-extrabold text-ink">
              {editingEmployee ? "Edit Employee Details" : "Hire New Employee"}
            </h3>

            <form onSubmit={handleSaveEmployee} className="space-y-3.5">
              <div>
                <Label className="text-xs">Full Name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Muhammad Ali" className="mt-1 h-9 text-xs" required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Employee ID</Label>
                  <Input value={empNum} onChange={(e) => setEmpNum(e.target.value)} className="mt-1 h-9 text-xs font-mono" required />
                </div>
                <div>
                  <Label className="text-xs">Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0300-1234567" className="mt-1 h-9 text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Designation</Label>
                  <Input value={designation} onChange={(e) => setDesignation(e.target.value)} className="mt-1 h-9 text-xs" required />
                </div>
                <div>
                  <Label className="text-xs">Assigned Shift</Label>
                  <select value={shiftType} onChange={(e) => setShiftType(e.target.value)} className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-2.5 text-xs font-semibold">
                    <option value="MORNING">Morning (08:00â€“16:00)</option>
                    <option value="EVENING">Evening (16:00â€“00:00)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Salary Type</Label>
                  <select value={salaryType} onChange={(e) => setSalaryType(e.target.value)} className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-2.5 text-xs font-semibold">
                    <option value="MONTHLY">Monthly Salary</option>
                    <option value="DAILY">Daily Wage</option>
                    <option value="HOURLY">Hourly Rate</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Salary Amount (Rs.)</Label>
                  <Input type="number" min="0" value={salaryPkr} onChange={(e) => setSalaryPkr(e.target.value)} className="mt-1 h-9 font-mono text-xs" required />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button type="submit" size="sm">{editingEmployee ? "Update Employee" : "Save Employee"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Request Leave */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-4">
            <h3 className="font-display text-base font-extrabold text-ink">Submit Leave Request</h3>

            <form onSubmit={handleLeaveSubmit} className="space-y-3.5">
              <div>
                <Label className="text-xs">Select Employee</Label>
                <select value={leaveEmpId} onChange={(e) => setLeaveEmpId(e.target.value)} className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-2.5 text-xs font-semibold">
                  {activeEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.designation})</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs">Leave Type</Label>
                <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-2.5 text-xs font-semibold">
                  <option value="CASUAL">Casual Leave</option>
                  <option value="SICK">Sick Leave</option>
                  <option value="EMERGENCY">Emergency Leave</option>
                  <option value="UNPAID">Unpaid Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Start Date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 h-9 text-xs font-mono" required />
                </div>
                <div>
                  <Label className="text-xs">End Date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 h-9 text-xs font-mono" required />
                </div>
              </div>

              <div>
                <Label className="text-xs">Reason</Label>
                <Input value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} placeholder="e.g. Family medical emergency" className="mt-1 h-9 text-xs" required />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowLeaveModal(false)}>Cancel</Button>
                <Button type="submit" size="sm">Submit Request</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Payslip View */}
      {selectedPayslipEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display text-base font-extrabold text-ink">Techno World Payslip</h3>
                <p className="text-xs text-muted">Official Salary Statement</p>
              </div>
              <Badge variant="success">PAID / READY</Badge>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">Employee Name:</span>
                <strong className="text-ink">{selectedPayslipEmp.full_name} ({selectedPayslipEmp.employee_number})</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Designation:</span>
                <strong className="text-ink">{selectedPayslipEmp.designation}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Salary Structure:</span>
                <strong className="text-ink">{selectedPayslipEmp.salary_type}</strong>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-muted font-bold">Base Salary:</span>
                <strong className="font-mono text-brand-dark">{formatPkr(selectedPayslipEmp.salary_amount_paisa)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted font-bold">Net Payable:</span>
                <strong className="font-mono text-success text-sm">{formatPkr(selectedPayslipEmp.salary_amount_paisa)}</strong>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" size="sm" onClick={() => setSelectedPayslipEmp(null)}>Close Payslip</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}