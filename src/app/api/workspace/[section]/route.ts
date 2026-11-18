import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { hasRequiredRole } from "@/lib/auth/permissions";
import type { UserRole } from "@/types/system";
import {
  loadAuditSectionData,
  loadClosingSectionData,
  loadCustomersSectionData,
  loadDashboardSectionData,
  loadEmployeesSectionData,
  loadExpensesSectionData,
  loadFinanceSectionData,
  loadInventorySectionData,
  loadPosSectionData,
  loadReportsSectionData,
  loadSalesSectionData,
  loadShiftsSectionData,
} from "@/lib/workspace/loaders";

const SECTION_ROLES: Record<string, UserRole[]> = {
  dashboard: ["OWNER", "MANAGER", "EMPLOYEE"],
  closing: ["OWNER", "MANAGER", "EMPLOYEE"],
  pos: ["OWNER", "MANAGER", "EMPLOYEE"],
  sales: ["OWNER", "MANAGER", "EMPLOYEE"],
  shifts: ["OWNER", "MANAGER", "EMPLOYEE"],
  expenses: ["OWNER", "MANAGER", "EMPLOYEE"],
  customers: ["OWNER", "MANAGER", "EMPLOYEE"],
  inventory: ["OWNER", "MANAGER"],
  employees: ["OWNER", "MANAGER"],
  staff: ["OWNER", "MANAGER"],
  reports: ["OWNER", "MANAGER"],
  finance: ["OWNER"],
  audit: ["OWNER"],
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ section: string }> }
) {
  try {
    const ctx = await getAuthenticatedShopContext();
    if (!ctx || !ctx.businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { section } = await context.params;
    const allowedRoles = SECTION_ROLES[section];
    if (!allowedRoles) {
      return NextResponse.json({ error: "Unknown section" }, { status: 404 });
    }

    if (!hasRequiredRole(ctx.role, allowedRoles)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    let payload: unknown;

    switch (section) {
      case "dashboard":
        payload = await loadDashboardSectionData(
          ctx.businessId,
          sp.get("period") ?? undefined,
          sp.get("start") ?? undefined,
          sp.get("end") ?? undefined
        );
        break;
      case "closing":
        payload = await loadClosingSectionData(
          sp.get("date") ?? undefined,
          sp.get("shift") ?? undefined
        );
        break;
      case "pos":
        payload = await loadPosSectionData(ctx.businessId);
        break;
      case "sales":
        payload = await loadSalesSectionData(
          ctx.businessId,
          sp.get("limit") ? Number(sp.get("limit")) : 200
        );
        break;
      case "inventory":
        payload = await loadInventorySectionData(ctx.businessId);
        break;
      case "expenses":
        payload = await loadExpensesSectionData(ctx.businessId);
        break;
      case "finance":
        payload = await loadFinanceSectionData(ctx.businessId);
        break;
      case "employees":
      case "staff":
        payload = await loadEmployeesSectionData(
          ctx.businessId,
          sp.get("date") ?? undefined
        );
        break;
      case "shifts":
        payload = await loadShiftsSectionData(ctx.businessId);
        break;
      case "customers":
        payload = await loadCustomersSectionData(ctx.businessId);
        break;
      case "reports":
        payload = await loadReportsSectionData(
          ctx.businessId,
          sp.get("period") ?? undefined,
          sp.get("start") ?? undefined,
          sp.get("end") ?? undefined
        );
        break;
      case "audit":
        payload = await loadAuditSectionData(
          ctx.businessId,
          sp.get("limit") ? Number(sp.get("limit")) : 100
        );
        break;
      default:
        return NextResponse.json({ error: "Unknown section" }, { status: 404 });
    }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Fetched-At": new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[api/workspace] load error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
