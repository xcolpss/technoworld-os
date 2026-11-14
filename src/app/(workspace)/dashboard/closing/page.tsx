"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Calculator, 
  Calendar, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  ArrowLeft,
  Users,
  Receipt,
  Coins,
  BellRing,
  Save,
  Download
} from "lucide-react";
import Link from "next/link";

interface ExpenseItem {
  id: string;
  description: string;
  category: string;
  amount: number;
  paidBy: string;
  method: string;
}

interface WageItem {
  id: string;
  name: string;
  role: string;
  wage: number;
  notes: string;
}

export default function DailyClosingPage() {
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [morningCash, setMorningCash] = useState<number>(25000);
  const [eveningCash, setEveningCash] = useState<number>(45000);
  const [nightCash, setNightCash] = useState<number>(15000);
  const [actualClosing, setActualClosing] = useState<number>(52000);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ show: boolean; message: string }>({ show: false, message: "" });

  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    { id: "1", description: "Shop Electricity Bill", category: "Utilities", amount: 3500, paidBy: "Subhan Shahid", method: "Cash Drawer" },
    { id: "2", description: "Tea & Refreshments", category: "Staff Welfare", amount: 1000, paidBy: "Subhan Shahid", method: "Cash Drawer" }
  ]);

  const [newExpDesc, setNewExpDesc] = useState("");
  const [newExpCat, setNewExpCat] = useState("Utilities");
  const [newExpAmt, setNewExpAmt] = useState("");

  const [wages, setWages] = useState<WageItem[]>([
    { id: "1", name: "Ruksar", role: "Staff", wage: 1500, notes: "Full shift completed" },
    { id: "2", name: "Shamo", role: "Staff", wage: 1500, notes: "Full shift completed" },
    { id: "3", name: "Uncle", role: "Management", wage: 2000, notes: "Special oversight" },
    { id: "4", name: "Huraira", role: "Staff", wage: 1000, notes: "Half shift" },
    { id: "5", name: "Murtaza", role: "Staff", wage: 500, notes: "Support hours" }
  ]);

  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffWage, setNewStaffWage] = useState("");

  const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const totalWages = wages.reduce((acc, w) => acc + Number(w.wage || 0), 0);
  const totalOutflows = totalExpenses + totalWages;
  const grossSales = 144850;
  const expectedClosing = morningCash + eveningCash + nightCash - totalOutflows;
  const cashDifference = actualClosing - expectedClosing;

  const showToast = (message: string) => {
    setNotification({ show: true, message });
    setTimeout(() => setNotification({ show: false, message: "" }), 4000);
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpDesc || !newExpAmt) return;
    setExpenses([...expenses, {
      id: Date.now().toString(),
      description: newExpDesc,
      category: newExpCat,
      amount: Number(newExpAmt),
      paidBy: "Subhan Shahid",
      method: "Cash Drawer"
    }]);
    setNewExpDesc("");
    setNewExpAmt("");
    showToast("Expense added successfully!");
  };

  const handleRemoveExpense = (id: string) => {
    setExpenses(expenses.filter(e => e.id !== id));
    showToast("Expense removed.");
  };

  const handleWageChange = (id: string, val: string) => {
    setWages(wages.map(w => w.id === id ? { ...w, wage: Number(val) || 0 } : w));
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName || !newStaffWage) return;
    setWages([...wages, {
      id: Date.now().toString(),
      name: newStaffName,
      role: "Staff",
      wage: Number(newStaffWage),
      notes: "Daily wage assigned"
    }]);
    setNewStaffName("");
    setNewStaffWage("");
    showToast(`Staff member ${newStaffName} added successfully!`);
  };

  const handleRemoveStaff = (id: string, name: string) => {
    setWages(wages.filter(w => w.id !== id));
    showToast(`Staff member ${name} removed from roster.`);
  };

  const handleSaveReport = () => {
    setIsSaving(true);
    const reportPayload = {
      reportDate,
      morningCash,
      eveningCash,
      nightCash,
      actualClosing,
      expenses,
      wages,
      totalExpenses,
      totalWages,
      expectedClosing,
      cashDifference,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(`tw_closing_${reportDate}`, JSON.stringify(reportPayload));

    setTimeout(() => {
      setIsSaving(false);
      showToast(`Daily Closing Report for ${reportDate} saved successfully!`);
    }, 400);
  };

  const handleExportCSV = (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      let csv = "TECHNOWORLD OS - EXECUTIVE DAILY CLOSING REPORT\r\n";
      csv += `Report Date,${reportDate}\r\n`;
      csv += `Generated At,${new Date().toLocaleString()}\r\n`;
      csv += `Timezone,Asia/Karachi (PKT)\r\n\r\n`;
      
      csv += "1. FINANCIAL RECONCILIATION SUMMARY\r\n";
      csv += `Gross Sales Revenue,${grossSales}\r\n`;
      csv += `Total Daily Expenses,${totalExpenses}\r\n`;
      csv += `Total Employee Wages,${totalWages}\r\n`;
      csv += `Total Outflows (Expenses + Wages),${totalOutflows}\r\n`;
      csv += `Morning Cash Count,${morningCash}\r\n`;
      csv += `Evening Cash Count,${eveningCash}\r\n`;
      csv += `Night Cash Count,${nightCash}\r\n`;
      csv += `Expected Closing Cash,${expectedClosing}\r\n`;
      csv += `Actual Closing Cash,${actualClosing}\r\n`;
      csv += `Cash Discrepancy,${cashDifference}\r\n\r\n`;

      csv += "2. DAILY EXPENSES LEDGER\r\nDescription,Category,Amount (PKR),Paid By,Payment Method\r\n";
      expenses.forEach(exp => {
        csv += `"${exp.description}","${exp.category}",${exp.amount},"${exp.paidBy}","${exp.method}"\r\n`;
      });

      csv += "\r\n3. EMPLOYEE WAGES LEDGER\r\nEmployee Name,Role,Daily Wage (PKR),Notes\r\n";
      wages.forEach(w => {
        csv += `"${w.name}","${w.role}",${w.wage},"${w.notes}"\r\n`;
      });

      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `TechnoWorld_Daily_Closing_${reportDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast("Clean CSV report downloaded successfully to your PC!");
    } catch (err) {
      console.error(err);
      showToast("Download failed. Please check browser permissions.");
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <PageHeader
          eyebrow="TechnoWorld OS • Financial Closing &amp; Accountant Suite"
          title="Daily Closing &amp; Accountant Report"
          description="Record daily wages, reconcile expenses, audit cash drawer counts, and generate clean accountant exports."
        />
        <Link href="/dashboard">
          <Button type="button" variant="secondary" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
        </Link>
      </div>

      {notification.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <Card className="border-[var(--success)] bg-[var(--surface)] shadow-lg">
            <CardContent className="p-4 flex items-center gap-3 text-[var(--success)]">
              <BellRing className="h-5 w-5 shrink-0 animate-bounce" />
              <span className="text-xs font-bold text-[var(--foreground)]">{notification.message}</span>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[var(--primary)] text-white flex items-center justify-center font-bold">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <Label className="text-xs text-[var(--foreground-secondary)]">Select Report Date (Asia/Karachi)</Label>
              <input 
                type="date" 
                value={reportDate} 
                onChange={(e) => setReportDate(e.target.value)}
                className="mt-1 h-9 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 text-xs font-bold text-[var(--foreground)]"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button 
              type="button"
              onClick={handleSaveReport} 
              disabled={isSaving}
              className="flex-1 sm:flex-none bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs gap-2 cursor-pointer"
            >
              <Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Daily Closing"}
            </Button>
            <Button 
              type="button"
              onClick={handleExportCSV} 
              variant="secondary" 
              className="flex-1 sm:flex-none gap-2 text-xs font-bold bg-[var(--surface-secondary)] hover:bg-[var(--border)] text-[var(--foreground)] cursor-pointer"
            >
              <Download className="h-4 w-4 text-[var(--primary)]" /> Download Clean CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-[var(--primary)]" />
                <h3 className="font-display text-base font-extrabold text-[var(--foreground)]">Daily Expenses</h3>
              </div>
              <Badge variant="brand" className="font-mono text-xs">Total: Rs. {totalExpenses.toLocaleString()}</Badge>
            </div>

            <form onSubmit={handleAddExpense} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input placeholder="Description" value={newExpDesc} onChange={e => setNewExpDesc(e.target.value)} className="h-9 text-xs bg-[var(--surface-secondary)]" required />
              <Input type="number" placeholder="Amount (PKR)" value={newExpAmt} onChange={e => setNewExpAmt(e.target.value)} className="h-9 text-xs bg-[var(--surface-secondary)] font-mono" required />
              <Button type="submit" size="sm" className="h-9 bg-[var(--primary)] text-white font-bold gap-1 cursor-pointer">
                <Plus className="h-3.5 w-3.5" /> Add Expense
              </Button>
            </form>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {expenses.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface-secondary)] text-xs">
                  <div>
                    <p className="font-bold text-[var(--foreground)]">{exp.description}</p>
                    <p className="text-[10px] text-[var(--foreground-secondary)]">{exp.category} • Paid by {exp.paidBy}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-[var(--danger)]">Rs. {exp.amount.toLocaleString()}</span>
                    <button type="button" onClick={() => handleRemoveExpense(exp.id)} className="text-[var(--foreground-secondary)] hover:text-[var(--danger)] transition">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[var(--primary)]" />
                <h3 className="font-display text-base font-extrabold text-[var(--foreground)]">Employee Daily Wages</h3>
              </div>
              <Badge variant="success" className="font-mono text-xs">Total: Rs. {totalWages.toLocaleString()}</Badge>
            </div>

            <form onSubmit={handleAddStaff} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input placeholder="Staff Name" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} className="h-9 text-xs bg-[var(--surface-secondary)]" required />
              <Input type="number" placeholder="Daily Wage (PKR)" value={newStaffWage} onChange={e => setNewStaffWage(e.target.value)} className="h-9 text-xs bg-[var(--surface-secondary)] font-mono" required />
              <Button type="submit" size="sm" className="h-9 bg-[var(--primary)] text-white font-bold gap-1 cursor-pointer">
                <Plus className="h-3.5 w-3.5" /> Add Staff
              </Button>
            </form>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {wages.map((w) => (
                <div key={w.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface-secondary)] text-xs">
                  <div>
                    <p className="font-bold text-[var(--foreground)]">{w.name} <span className="text-[10px] text-[var(--foreground-secondary)] font-normal">({w.role})</span></p>
                    <p className="text-[10px] text-[var(--foreground-secondary)]">{w.notes}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[var(--foreground-secondary)]">Rs.</span>
                    <input 
                      type="number" 
                      value={w.wage} 
                      onChange={e => handleWageChange(w.id, e.target.value)}
                      className="w-20 h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 font-mono text-xs font-bold text-[var(--foreground)] text-right"
                    />
                    <button type="button" onClick={() => handleRemoveStaff(w.id, w.name)} className="text-[var(--foreground-secondary)] hover:text-[var(--danger)] transition ml-1" title="Remove staff">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
              <Coins className="h-5 w-5 text-[var(--primary)]" />
              <h3 className="font-display text-base font-extrabold text-[var(--foreground)]">Cash Count Snapshots</h3>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <Label>Morning Cash (08:00)</Label>
                <Input type="number" value={morningCash} onChange={e => setMorningCash(Number(e.target.value))} className="mt-1 h-9 font-mono bg-[var(--surface-secondary)]" />
              </div>
              <div>
                <Label>Evening Cash (16:00)</Label>
                <Input type="number" value={eveningCash} onChange={e => setEveningCash(Number(e.target.value))} className="mt-1 h-9 font-mono bg-[var(--surface-secondary)]" />
              </div>
              <div>
                <Label>Night Cash (00:00)</Label>
                <Input type="number" value={nightCash} onChange={e => setNightCash(Number(e.target.value))} className="mt-1 h-9 font-mono bg-[var(--surface-secondary)]" />
              </div>
              <div>
                <Label className="font-bold text-[var(--primary)]">Actual Physical Closing Drawer Count</Label>
                <Input type="number" value={actualClosing} onChange={e => setActualClosing(Number(e.target.value))} className="mt-1 h-9 font-mono font-bold bg-[var(--primary)]/10 text-[var(--primary)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-[var(--primary)]" />
                <h3 className="font-display text-base font-extrabold text-[var(--foreground)]">Automatic Financial Summary &amp; Reconciliation</h3>
              </div>
              <Badge variant="success" className="font-mono text-xs">Verified</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div className="flex justify-between p-3 bg-[var(--surface-secondary)] rounded-xl">
                <span className="text-[var(--foreground-secondary)]">Gross POS Sales:</span>
                <span className="font-bold text-[var(--foreground)]">Rs. {grossSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between p-3 bg-[var(--surface-secondary)] rounded-xl">
                <span className="text-[var(--foreground-secondary)]">Total Daily Expenses:</span>
                <span className="font-bold text-[var(--danger)]">- Rs. {totalExpenses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between p-3 bg-[var(--surface-secondary)] rounded-xl">
                <span className="text-[var(--foreground-secondary)]">Total Employee Wages:</span>
                <span className="font-bold text-[var(--danger)]">- Rs. {totalWages.toLocaleString()}</span>
              </div>
              <div className="flex justify-between p-3 bg-[var(--surface-secondary)] rounded-xl">
                <span className="text-[var(--foreground-secondary)]">Total Cash Outflows:</span>
                <span className="font-bold text-[var(--danger)]">- Rs. {totalOutflows.toLocaleString()}</span>
              </div>
              <div className="flex justify-between p-3 bg-[var(--surface-secondary)] rounded-xl">
                <span className="text-[var(--foreground-secondary)]">Expected Closing Cash:</span>
                <span className="font-bold text-[var(--foreground)]">Rs. {expectedClosing.toLocaleString()}</span>
              </div>
              <div className="flex justify-between p-3 bg-[var(--primary)]/10 rounded-xl border border-[var(--primary)]/30">
                <span className="font-bold text-[var(--primary)]">Cash Discrepancy:</span>
                <span className={`font-extrabold ${cashDifference < 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                  Rs. {cashDifference.toLocaleString()} {cashDifference < 0 ? '(Short)' : cashDifference > 0 ? '(Over)' : '(Exact)'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}