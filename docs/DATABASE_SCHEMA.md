# TechnoWorld OS — Database Schema & Entity Relationship Diagram

## Design Principles
- **62 Normalized Tables** organized across 13 operational and financial domains (supabase/migrations/0001 through 0004).
- **Primary Keys:** UUID on every table (61 auto-generated via gen_random_uuid(), plus profiles linked 1:1 to auth.users).
- **Tenant Isolation:** Every business-scoped table carries business_id UUID NOT NULL referencing businesses(id).
- **Monetary Precision:** All monetary columns end in _paisa and use BIGINT (1 PKR = 100 paisa).
- **Multi-Currency Readiness:** Every financial record stores currency CHAR(3) NOT NULL DEFAULT 'PKR'.
- **Immutability:** Posted ledger records (journal_entries) and audit_logs cannot be silently modified or deleted.

## Core Relationships Summary
- **Business & Access:** businesses -> memberships -> profiles & roles -> role_permissions -> permissions; businesses -> terminals.
- **Employees & Shifts:** businesses -> employees -> employee_compensation_history & attendance; businesses -> shifts -> cash_sessions -> shift_handovers.
- **Catalog, Inventory & Sales:** businesses -> categories -> products & services; purchases -> purchase_items -> inventory_lots & stock_movements; shifts & cash_sessions -> sales -> sale_items, payments, refunds & refund_items.
- **Finance, Owners, Payroll & Accounting:** accounts -> cash_movements & expenses; owners -> owner_contributions, owner_loans -> owner_loan_repayments, owner_drawings & owner_distributions; payroll_periods -> payroll_items -> salary_payments & salary_advances; chart_of_accounts & fiscal_periods -> journal_entries -> journal_lines.
- **Governance, Sync, Reporting & Settings:** audit_logs, approval_rules -> approval_requests, idempotency_keys; sync_devices -> sync_queue -> sync_conflicts & sync_events; saved_reports, daily_report_snapshots, report_exports; business_settings, receipt_settings, printer_settings, notification_settings.
