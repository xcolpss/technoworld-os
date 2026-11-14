-- ============================================================================
-- TECHNOWORLD OS — MIGRATION 0005
-- Phase 3: Security Foundation, Helper Functions & Row Level Security (RLS)
-- Enforces business isolation and OWNER / MANAGER / EMPLOYEE boundaries
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SECURITY HELPER FUNCTIONS
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_business_member(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.business_id = p_business_id
      AND m.profile_id = auth.uid()
      AND m.status = 'ACTIVE'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_business_role(p_business_id UUID, p_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.roles r ON r.id = m.role_id
    WHERE m.business_id = p_business_id
      AND m.profile_id = auth.uid()
      AND m.status = 'ACTIVE'
      AND r.code = ANY(p_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_business_owner(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_business_role(p_business_id, ARRAY['OWNER']);
$$;

-- ----------------------------------------------------------------------------
-- 2. ENABLE RLS ON ALL DOMAIN TABLES
-- ----------------------------------------------------------------------------

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminals ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_compensation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_handovers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_loan_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_drawings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_distributions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sync_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_exports ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printer_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3. POLICIES: BUSINESS & ACCESS
-- ----------------------------------------------------------------------------

CREATE POLICY businesses_select ON public.businesses
  FOR SELECT USING (public.is_business_member(id));

CREATE POLICY businesses_update_owner ON public.businesses
  FOR UPDATE USING (public.is_business_owner(id))
  WITH CHECK (public.is_business_owner(id));

CREATE POLICY profiles_select_self_or_colleague ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.memberships m_self
      JOIN public.memberships m_other ON m_self.business_id = m_other.business_id
      WHERE m_self.profile_id = auth.uid()
        AND m_self.status = 'ACTIVE'
        AND m_other.profile_id = profiles.id
    )
  );

CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY roles_select_member ON public.roles
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY roles_manage_owner ON public.roles
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY permissions_select_authenticated ON public.permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY role_permissions_select_member ON public.role_permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_permissions.role_id
        AND public.is_business_member(r.business_id)
    )
  );

CREATE POLICY role_permissions_manage_owner ON public.role_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_permissions.role_id
        AND public.is_business_owner(r.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_permissions.role_id
        AND public.is_business_owner(r.business_id)
    )
  );

CREATE POLICY memberships_select_member ON public.memberships
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY memberships_manage_owner ON public.memberships
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY terminals_select_member ON public.terminals
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY terminals_manage_owner ON public.terminals
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

-- ----------------------------------------------------------------------------
-- 4. POLICIES: EMPLOYEES & SHIFTS
-- ----------------------------------------------------------------------------

CREATE POLICY employees_select_member ON public.employees
  FOR SELECT USING (
    public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER'])
    OR profile_id = auth.uid()
  );

CREATE POLICY employees_manage_owner_manager ON public.employees
  FOR ALL USING (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']))
  WITH CHECK (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

CREATE POLICY emp_comp_select ON public.employee_compensation_history
  FOR SELECT USING (
    public.is_business_owner(business_id)
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = employee_compensation_history.employee_id
        AND e.profile_id = auth.uid()
    )
  );

CREATE POLICY emp_comp_manage_owner ON public.employee_compensation_history
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY attendance_select ON public.attendance
  FOR SELECT USING (
    public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER'])
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = attendance.employee_id
        AND e.profile_id = auth.uid()
    )
  );

CREATE POLICY attendance_insert_member ON public.attendance
  FOR INSERT WITH CHECK (public.is_business_member(business_id));

CREATE POLICY attendance_update_manager ON public.attendance
  FOR UPDATE USING (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']))
  WITH CHECK (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

CREATE POLICY shifts_select_member ON public.shifts
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY shifts_insert_member ON public.shifts
  FOR INSERT WITH CHECK (public.is_business_member(business_id));

CREATE POLICY shifts_update_member ON public.shifts
  FOR UPDATE USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));

CREATE POLICY cash_sessions_select_member ON public.cash_sessions
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY cash_sessions_insert_member ON public.cash_sessions
  FOR INSERT WITH CHECK (public.is_business_member(business_id));

CREATE POLICY cash_sessions_update_member ON public.cash_sessions
  FOR UPDATE USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));

CREATE POLICY shift_handovers_select_member ON public.shift_handovers
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY shift_handovers_insert_member ON public.shift_handovers
  FOR INSERT WITH CHECK (public.is_business_member(business_id));

CREATE POLICY shift_handovers_update_member ON public.shift_handovers
  FOR UPDATE USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));

-- ----------------------------------------------------------------------------
-- 5. POLICIES: CATALOG, INVENTORY & SALES
-- ----------------------------------------------------------------------------

CREATE POLICY categories_select_member ON public.categories
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY categories_manage_manager ON public.categories
  FOR ALL USING (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']))
  WITH CHECK (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

CREATE POLICY products_select_member ON public.products
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY products_manage_manager ON public.products
  FOR ALL USING (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']))
  WITH CHECK (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

CREATE POLICY services_select_member ON public.services
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY services_manage_manager ON public.services
  FOR ALL USING (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']))
  WITH CHECK (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

CREATE POLICY suppliers_select_manager ON public.suppliers
  FOR SELECT USING (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

CREATE POLICY suppliers_manage_manager ON public.suppliers
  FOR ALL USING (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']))
  WITH CHECK (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

CREATE POLICY customers_select_member ON public.customers
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY customers_insert_update_member ON public.customers
  FOR INSERT WITH CHECK (public.is_business_member(business_id));

CREATE POLICY customers_update_member ON public.customers
  FOR UPDATE USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));

CREATE POLICY purchases_manage_manager ON public.purchases
  FOR ALL USING (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']))
  WITH CHECK (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

CREATE POLICY purchase_items_manage_manager ON public.purchase_items
  FOR ALL USING (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']))
  WITH CHECK (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

CREATE POLICY inventory_lots_select_member ON public.inventory_lots
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY inventory_lots_manage_manager ON public.inventory_lots
  FOR ALL USING (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']))
  WITH CHECK (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

CREATE POLICY stock_adjustments_select_manager ON public.stock_adjustments
  FOR SELECT USING (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

CREATE POLICY stock_adjustments_insert_member ON public.stock_adjustments
  FOR INSERT WITH CHECK (public.is_business_member(business_id));

CREATE POLICY stock_adjustments_update_manager ON public.stock_adjustments
  FOR UPDATE USING (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']))
  WITH CHECK (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

CREATE POLICY stock_movements_select_manager ON public.stock_movements
  FOR SELECT USING (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

CREATE POLICY stock_movements_insert_member ON public.stock_movements
  FOR INSERT WITH CHECK (public.is_business_member(business_id));

CREATE POLICY sales_select_member ON public.sales
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY sales_insert_member ON public.sales
  FOR INSERT WITH CHECK (public.is_business_member(business_id));

CREATE POLICY sales_update_manager ON public.sales
  FOR UPDATE USING (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']))
  WITH CHECK (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

CREATE POLICY sale_items_select_member ON public.sale_items
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY sale_items_insert_member ON public.sale_items
  FOR INSERT WITH CHECK (public.is_business_member(business_id));

CREATE POLICY payments_select_member ON public.payments
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY payments_insert_member ON public.payments
  FOR INSERT WITH CHECK (public.is_business_member(business_id));

CREATE POLICY refunds_select_member ON public.refunds
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY refunds_insert_member ON public.refunds
  FOR INSERT WITH CHECK (public.is_business_member(business_id));

CREATE POLICY refunds_update_manager ON public.refunds
  FOR UPDATE USING (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']))
  WITH CHECK (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

CREATE POLICY refund_items_select_member ON public.refund_items
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY refund_items_insert_member ON public.refund_items
  FOR INSERT WITH CHECK (public.is_business_member(business_id));

-- ----------------------------------------------------------------------------
-- 6. POLICIES: FINANCE, EXPENSES & CONFIDENTIAL OWNER ACCOUNTS
-- ----------------------------------------------------------------------------

CREATE POLICY accounts_select_member ON public.accounts
  FOR SELECT USING (
    public.is_business_owner(business_id)
    OR (public.is_business_member(business_id) AND is_owner_restricted = FALSE)
  );

CREATE POLICY accounts_manage_owner ON public.accounts
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY account_transfers_manage_owner ON public.account_transfers
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY cash_movements_select_member ON public.cash_movements
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY cash_movements_insert_member ON public.cash_movements
  FOR INSERT WITH CHECK (public.is_business_member(business_id));

CREATE POLICY expense_categories_select_member ON public.expense_categories
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY expense_categories_manage_owner ON public.expense_categories
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY expenses_select_member ON public.expenses
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY expenses_insert_member ON public.expenses
  FOR INSERT WITH CHECK (public.is_business_member(business_id));

CREATE POLICY expenses_update_manager ON public.expenses
  FOR UPDATE USING (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']))
  WITH CHECK (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

-- Confidential Owner Capital Tables (STRICTLY OWNER ONLY)
CREATE POLICY owners_owner_only ON public.owners
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY owner_contributions_owner_only ON public.owner_contributions
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY owner_loans_owner_only ON public.owner_loans
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY owner_loan_repayments_owner_only ON public.owner_loan_repayments
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY owner_drawings_owner_only ON public.owner_drawings
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY owner_distributions_owner_only ON public.owner_distributions
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

-- ----------------------------------------------------------------------------
-- 7. POLICIES: PAYROLL & DOUBLE-ENTRY ACCOUNTING
-- ----------------------------------------------------------------------------

CREATE POLICY payroll_periods_owner_only ON public.payroll_periods
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY payroll_items_select ON public.payroll_items
  FOR SELECT USING (
    public.is_business_owner(business_id)
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = payroll_items.employee_id
        AND e.profile_id = auth.uid()
    )
  );

CREATE POLICY payroll_items_manage_owner ON public.payroll_items
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY salary_advances_select ON public.salary_advances
  FOR SELECT USING (
    public.is_business_owner(business_id)
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = salary_advances.employee_id
        AND e.profile_id = auth.uid()
    )
  );

CREATE POLICY salary_advances_manage_owner ON public.salary_advances
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY salary_payments_owner_only ON public.salary_payments
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY chart_of_accounts_select_manager ON public.chart_of_accounts
  FOR SELECT USING (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

CREATE POLICY chart_of_accounts_manage_owner ON public.chart_of_accounts
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY fiscal_periods_select_manager ON public.fiscal_periods
  FOR SELECT USING (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

CREATE POLICY fiscal_periods_manage_owner ON public.fiscal_periods
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY journal_entries_select_manager ON public.journal_entries
  FOR SELECT USING (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

CREATE POLICY journal_entries_manage_owner ON public.journal_entries
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY journal_lines_select_manager ON public.journal_lines
  FOR SELECT USING (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

CREATE POLICY journal_lines_manage_owner ON public.journal_lines
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

-- ----------------------------------------------------------------------------
-- 8. POLICIES: GOVERNANCE, OFFLINE SYNC, REPORTING & SETTINGS
-- ----------------------------------------------------------------------------

CREATE POLICY audit_logs_select_owner ON public.audit_logs
  FOR SELECT USING (public.is_business_owner(business_id));

CREATE POLICY audit_logs_insert_member ON public.audit_logs
  FOR INSERT WITH CHECK (public.is_business_member(business_id));

CREATE POLICY approval_rules_select_member ON public.approval_rules
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY approval_rules_manage_owner ON public.approval_rules
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY approval_requests_select_member ON public.approval_requests
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY approval_requests_insert_member ON public.approval_requests
  FOR INSERT WITH CHECK (public.is_business_member(business_id));

CREATE POLICY approval_requests_update_manager ON public.approval_requests
  FOR UPDATE USING (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']))
  WITH CHECK (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

CREATE POLICY idempotency_keys_member ON public.idempotency_keys
  FOR ALL USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));

CREATE POLICY sync_devices_member ON public.sync_devices
  FOR ALL USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));

CREATE POLICY sync_queue_member ON public.sync_queue
  FOR ALL USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));

CREATE POLICY sync_conflicts_select_member ON public.sync_conflicts
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY sync_conflicts_manage_manager ON public.sync_conflicts
  FOR ALL USING (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']))
  WITH CHECK (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

CREATE POLICY sync_events_member ON public.sync_events
  FOR ALL USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));

CREATE POLICY saved_reports_select ON public.saved_reports
  FOR SELECT USING (
    public.is_business_owner(business_id)
    OR (public.has_business_role(business_id, ARRAY['MANAGER']) AND is_owner_only = FALSE)
  );

CREATE POLICY saved_reports_manage_owner ON public.saved_reports
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY daily_snapshots_select_manager ON public.daily_report_snapshots
  FOR SELECT USING (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

CREATE POLICY daily_snapshots_manage_owner ON public.daily_report_snapshots
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY report_exports_select_manager ON public.report_exports
  FOR SELECT USING (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

CREATE POLICY report_exports_insert_manager ON public.report_exports
  FOR INSERT WITH CHECK (public.has_business_role(business_id, ARRAY['OWNER', 'MANAGER']));

CREATE POLICY business_settings_select_member ON public.business_settings
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY business_settings_manage_owner ON public.business_settings
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY receipt_settings_select_member ON public.receipt_settings
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY receipt_settings_manage_owner ON public.receipt_settings
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY printer_settings_select_member ON public.printer_settings
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY printer_settings_manage_owner ON public.printer_settings
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY notification_settings_select_member ON public.notification_settings
  FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY notification_settings_manage_owner ON public.notification_settings
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));
