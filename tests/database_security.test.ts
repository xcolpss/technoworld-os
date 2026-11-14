import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertAuthorizedRole,
  canAccessOwnerCapital,
  canManageFinancialSettings,
} from "../src/lib/auth/permissions";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = [
  "0001_business_access_shifts.sql",
  "0002_catalog_inventory_sales.sql",
  "0003_finance_owners_payroll_accounting.sql",
  "0004_governance_offline_reporting_settings.sql",
  "0005_row_level_security.sql",
];

const schemaSql = migrationFiles
  .slice(0, 4)
  .map((f) => fs.readFileSync(path.join(migrationsDir, f), "utf8"))
  .join("\n");

const rlsSql = fs.readFileSync(
  path.join(migrationsDir, "0005_row_level_security.sql"),
  "utf8"
);

describe("Phase 2–4 Database & Security Validation", () => {
  it("1. Enforces business-level isolation and RLS on every created table", () => {
    const createdTables = Array.from(
      schemaSql.matchAll(/CREATE TABLE public\.([a-z0-9_]+)\s*\(/gi)
    ).map((m) => m[1]);

    expect(createdTables.length).toBe(62);

    for (const table of createdTables) {
      expect(rlsSql).toContain(
        `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`
      );
    }

    expect(rlsSql).toContain("CREATE OR REPLACE FUNCTION public.is_business_member");
  });

  it("2. Blocks EMPLOYEE and MANAGER from confidential owner capital accounts", () => {
    expect(canAccessOwnerCapital("OWNER")).toBe(true);
    expect(canAccessOwnerCapital("MANAGER")).toBe(false);
    expect(canAccessOwnerCapital("EMPLOYEE")).toBe(false);

    expect(canManageFinancialSettings("OWNER")).toBe(true);
    expect(canManageFinancialSettings("EMPLOYEE")).toBe(false);

    const ownerTables = [
      "owners",
      "owner_contributions",
      "owner_loans",
      "owner_loan_repayments",
      "owner_drawings",
      "owner_distributions",
    ];

    for (const table of ownerTables) {
      expect(rlsSql).toContain(`CREATE POLICY ${table}_owner_only ON public.${table}`);
      expect(rlsSql).toContain("public.is_business_owner(business_id)");
    }
  });

  it("3. Rejects unauthorized role actions in server authorization helpers", () => {
    expect(() =>
      assertAuthorizedRole("EMPLOYEE", ["OWNER"], "Modify Owner Capital")
    ).toThrow(/Unauthorized/);

    expect(() =>
      assertAuthorizedRole("OWNER", ["OWNER"], "Modify Owner Capital")
    ).not.toThrow();
  });

  it("4. Enforces balanced double-entry journal entries at database trigger level", () => {
    expect(schemaSql).toContain("CREATE OR REPLACE FUNCTION public.verify_journal_entry_balanced()");
    expect(schemaSql).toContain("v_total_debit <= 0 OR v_total_debit <> v_total_credit");
    expect(schemaSql).toContain("CREATE TRIGGER trg_journal_entry_balanced");
  });

  it("5. Stores all monetary amounts as integer BIGINT paisa with zero floating-point columns", () => {
    const floatMatches = schemaSql.match(
      /_paisa\s+(FLOAT|REAL|DOUBLE|NUMERIC|DECIMAL)/gi
    );
    expect(floatMatches).toBeNull();

    const paisaColumns = schemaSql.match(/[a-z0-9_]+_paisa\s+BIGINT/gi) ?? [];
    expect(paisaColumns.length).toBeGreaterThanOrEqual(35);
  });

  it("6. Enforces UUID primary keys and foreign key constraints across domains", () => {
    const uuidPks = schemaSql.match(/id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/g) ?? [];
    expect(uuidPks.length).toBe(61);
    expect(schemaSql).toContain("REFERENCES public.businesses(id)");
    expect(schemaSql).toContain("REFERENCES public.sales(id)");
    expect(schemaSql).toContain("REFERENCES public.journal_entries(id)");
  });

  it("7. Retains immutable audit logs and blocks UPDATE/DELETE mutations", () => {
    expect(schemaSql).toContain("CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()");
    expect(schemaSql).toContain("BEFORE UPDATE OR DELETE ON public.audit_logs");
    expect(rlsSql).not.toMatch(/CREATE POLICY .* ON public\.audit_logs\s+FOR (UPDATE|DELETE)/i);
  });

  it("8. Rejects duplicate transaction identifiers via unique constraints", () => {
    expect(schemaSql).toContain("UNIQUE (business_id, idempotency_key)");
    expect(schemaSql).toContain("UNIQUE (business_id, client_tx_id)");
    expect(schemaSql).toContain("UNIQUE (business_id, client_op_id)");
  });
});
