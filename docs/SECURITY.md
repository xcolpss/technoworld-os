# TechnoWorld OS — Security Architecture

## Multi-Layer Enforcement
1. **Database Layer (PostgreSQL RLS):** supabase/migrations/0005_row_level_security.sql enables Row Level Security on all 62 tables and enforces membership and role boundaries via SECURITY DEFINER helpers (is_business_member, has_business_role, is_business_owner).
2. **Server Layer:** src/lib/supabase/admin.ts imports "server-only" so SUPABASE_SERVICE_ROLE_KEY can never be bundled into client JavaScript. src/lib/auth/permissions.ts enforces role assertions before privileged server actions execute.
3. **UI Layer:** src/config/navigation.ts tailors visible modules to OWNER, MANAGER, and EMPLOYEE roles without relying on UI hiding for security.

## Role Boundaries
- **OWNER (3 Owners):** Full access to operations, remote monitoring, double-entry ledger, audit logs, settings, and confidential owner capital tables (owners, owner_contributions, owner_loans, owner_loan_repayments, owner_drawings, owner_distributions).
- **MANAGER:** Operational access to POS, inventory, shifts, staff attendance, and non-restricted reports; blocked from owner capital tables.
- **EMPLOYEE:** Counter access to POS sales, permitted discounts/refunds, shift cash sessions, shop expenses, and own attendance/payroll records; blocked from owner capital accounts and unrestricted financial settings.
