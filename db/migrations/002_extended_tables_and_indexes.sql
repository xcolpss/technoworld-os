-- ============================================================================
-- TECHNOWORLD OS — MIGRATION 002
-- Live extended tables, extra columns, compatibility fixes, permissions seed,
-- and composite performance indexes for sub-millisecond local queries.
-- ============================================================================

-- 1. Relax legacy audit_logs columns & add live action_type / actor_name / metadata
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_name TEXT NOT NULL DEFAULT 'System';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action_type TEXT NOT NULL DEFAULT 'ACTIVITY';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.audit_logs ALTER COLUMN actor_profile_id DROP NOT NULL;
ALTER TABLE public.audit_logs ALTER COLUMN action DROP NOT NULL;
ALTER TABLE public.audit_logs ALTER COLUMN entity_type DROP NOT NULL;
ALTER TABLE public.audit_logs ALTER COLUMN entity_id DROP NOT NULL;

-- Drop immutable trigger during snapshot import safety if present? Keep immutable updates/deletes blocked, inserts always allowed.
-- Note: triggers on core schema enforce insert-only immutability cleanly.

-- 2. Extend existing tables with live columns
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS sale_number INTEGER;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_name TEXT NOT NULL DEFAULT 'Walk-in Customer';
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_status_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_status_check
  CHECK (status IN ('DRAFT', 'PENDING', 'POSTED', 'completed', 'PARTIALLY_REFUNDED', 'REFUNDED', 'VOIDED', 'CANCELLED'));
ALTER TABLE public.sales ALTER COLUMN shift_id DROP NOT NULL;
ALTER TABLE public.sales ALTER COLUMN cash_session_id DROP NOT NULL;
ALTER TABLE public.sales ALTER COLUMN terminal_id DROP NOT NULL;
ALTER TABLE public.sales ALTER COLUMN sold_by DROP NOT NULL;

ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS item_name TEXT;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS category_name TEXT DEFAULT 'Accessories';
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS total_paisa BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS cost_price_paisa BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS actual_closing_paisa BIGINT DEFAULT 0;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.cash_sessions ALTER COLUMN shift_id DROP NOT NULL;

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS customer_type TEXT NOT NULL DEFAULT 'REGULAR';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_limit_paisa BIGINT DEFAULT 5000000;
ALTER TABLE public.customers ALTER COLUMN full_name DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.customer_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('CREDIT_SALE', 'REPAYMENT', 'PAYMENT', 'CREDIT', 'ADJUSTMENT')),
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
  payment_method TEXT,
  notes TEXT,
  recorded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS cnic TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS joining_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employment_status TEXT DEFAULT 'ACTIVE';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS assigned_shift_type TEXT DEFAULT 'MORNING';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS salary_type TEXT DEFAULT 'MONTHLY';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS salary_amount_paisa BIGINT DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employee_number TEXT;

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS work_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS scheduled_in TIME;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS actual_in TIMESTAMPTZ;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS scheduled_out TIME;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS actual_out TIMESTAMPTZ;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS early_departure_minutes INTEGER DEFAULT 0;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS overtime_minutes INTEGER DEFAULT 0;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS corrected_by UUID;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS correction_reason TEXT;

CREATE TABLE IF NOT EXISTS public.leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Shop Expense';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payment_source TEXT NOT NULL DEFAULT 'CASH_TILL';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS expense_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.expenses ALTER COLUMN expense_category_id DROP NOT NULL;
ALTER TABLE public.expenses ALTER COLUMN account_id DROP NOT NULL;
ALTER TABLE public.expenses ALTER COLUMN expense_number DROP NOT NULL;
ALTER TABLE public.expenses ALTER COLUMN vendor_or_payee DROP NOT NULL;
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_payment_source_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_payment_source_check
  CHECK (payment_source IN ('CASH_DRAWER', 'CASH_TILL', 'CASH_IN_HAND', 'OWNER_CASH', 'EASYPAISA', 'JAZZCASH', 'BANK_TRANSFER', 'BANK_WALLET'));

ALTER TABLE public.saved_reports ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.saved_reports ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.saved_reports ADD COLUMN IF NOT EXISTS generated_by UUID;
ALTER TABLE public.saved_reports ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.saved_reports ALTER COLUMN name DROP NOT NULL;

ALTER TABLE public.owner_contributions ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE public.owner_contributions ADD COLUMN IF NOT EXISTS contribution_type TEXT;
ALTER TABLE public.owner_contributions ADD COLUMN IF NOT EXISTS receiving_account_id UUID;
ALTER TABLE public.owner_contributions ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE public.owner_contributions ALTER COLUMN account_id DROP NOT NULL;

ALTER TABLE public.owner_drawings ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE public.owner_drawings ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.owner_drawings ADD COLUMN IF NOT EXISTS source_account_id UUID;
ALTER TABLE public.owner_drawings ADD COLUMN IF NOT EXISTS purpose TEXT;
ALTER TABLE public.owner_drawings ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE public.owner_drawings ALTER COLUMN account_id DROP NOT NULL;

ALTER TABLE public.account_transfers ADD COLUMN IF NOT EXISTS source_account_id UUID;
ALTER TABLE public.account_transfers ADD COLUMN IF NOT EXISTS destination_account_id UUID;
ALTER TABLE public.account_transfers ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE public.account_transfers ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.account_transfers ADD COLUMN IF NOT EXISTS recorded_by UUID;
ALTER TABLE public.account_transfers ALTER COLUMN from_account_id DROP NOT NULL;
ALTER TABLE public.account_transfers ALTER COLUMN to_account_id DROP NOT NULL;
ALTER TABLE public.account_transfers ALTER COLUMN initiated_by DROP NOT NULL;

-- 3. Live operational tables created directly in shop workflow
CREATE TABLE IF NOT EXISTS public.inventory_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  cost_price_paisa BIGINT NOT NULL DEFAULT 0,
  retail_price_paisa BIGINT NOT NULL DEFAULT 0,
  min_stock_alert INTEGER NOT NULL DEFAULT 5,
  unit TEXT NOT NULL DEFAULT 'pcs',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.pos_print_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bw_price_paisa BIGINT NOT NULL DEFAULT 0,
  color_price_paisa BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.pos_media_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'MOVIES',
  name TEXT NOT NULL,
  default_price_paisa BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.pos_composing_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_price_paisa BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.account_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  movement_kind TEXT NOT NULL CHECK (movement_kind IN ('TRANSFER', 'ADJUSTMENT')),
  from_account TEXT,
  to_account TEXT,
  amount_paisa BIGINT NOT NULL,
  reason TEXT NOT NULL,
  recorded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'CASH',
  owner_id UUID,
  opening_balance_paisa BIGINT NOT NULL DEFAULT 0,
  opening_balance_date DATE DEFAULT CURRENT_DATE,
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.daily_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  closing_date DATE NOT NULL,
  morning_cash_paisa BIGINT NOT NULL DEFAULT 0,
  evening_cash_paisa BIGINT NOT NULL DEFAULT 0,
  night_cash_paisa BIGINT NOT NULL DEFAULT 0,
  gross_sales_paisa BIGINT NOT NULL DEFAULT 0,
  refunds_paisa BIGINT NOT NULL DEFAULT 0,
  net_sales_paisa BIGINT NOT NULL DEFAULT 0,
  digital_sales_paisa BIGINT NOT NULL DEFAULT 0,
  total_expenses_paisa BIGINT NOT NULL DEFAULT 0,
  total_wages_paisa BIGINT NOT NULL DEFAULT 0,
  expected_closing_paisa BIGINT NOT NULL DEFAULT 0,
  actual_closing_paisa BIGINT NOT NULL DEFAULT 0,
  cash_variance_paisa BIGINT NOT NULL DEFAULT 0,
  expenses_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  wages_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'SUBMITTED',
  prepared_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, closing_date)
);

CREATE TABLE IF NOT EXISTS public.daily_closing_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  prepared_by UUID,
  morning_cash BIGINT DEFAULT 0,
  morning_notes TEXT,
  evening_cash BIGINT DEFAULT 0,
  evening_notes TEXT,
  night_cash BIGINT DEFAULT 0,
  night_notes TEXT,
  actual_closing_cash BIGINT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.daily_closing_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.daily_closing_reports(id) ON DELETE CASCADE,
  expense_id UUID,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  amount_paisa BIGINT NOT NULL DEFAULT 0,
  paid_by TEXT,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.daily_closing_wages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.daily_closing_reports(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  role TEXT,
  daily_wage_paisa BIGINT NOT NULL DEFAULT 0,
  status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.daily_closing_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.daily_closing_reports(id) ON DELETE CASCADE,
  actor TEXT,
  action TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 4. Seed static permissions cleanly
INSERT INTO public.permissions (code, module, description) VALUES
  ('pos.sale.create', 'POS', 'Create and post customer sales'),
  ('pos.discount.apply', 'POS', 'Apply permitted line or cart discounts'),
  ('pos.refund.create', 'POS', 'Issue permitted customer refunds'),
  ('shift.session.manage', 'SHIFTS', 'Open, close, and handover shift cash sessions'),
  ('expense.create', 'EXPENSES', 'Record operational shop expenses'),
  ('inventory.manage', 'INVENTORY', 'Manage products, purchases, and stock adjustments'),
  ('employee.manage', 'EMPLOYEES', 'Manage staff profiles and shift attendance'),
  ('payroll.manage', 'PAYROLL', 'Prepare and finalize staff payroll periods'),
  ('finance.accounts.manage', 'FINANCE', 'Manage bank/vault accounts and transfers'),
  ('owner.capital.access', 'OWNER', 'Access confidential owner equity, loans, and drawings'),
  ('audit.view', 'GOVERNANCE', 'Inspect immutable system audit logs'),
  ('settings.manage', 'SETTINGS', 'Configure business, receipt, printer, and role settings')
ON CONFLICT (code) DO NOTHING;

-- 5. Covering performance indexes for local sub-millisecond queries
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_exp ON public.auth_sessions (token_hash, expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_users_email_lower ON public.auth_users (lower(email));
CREATE INDEX IF NOT EXISTS idx_memberships_prof_status ON public.memberships (profile_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_biz_created ON public.sales (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_biz_salenum ON public.sales (business_id, sale_number DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_biz_sale ON public.sale_items (business_id, sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_biz_sale ON public.payments (business_id, sale_id);
CREATE INDEX IF NOT EXISTS idx_refunds_biz_posted ON public.refunds (business_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_refund_items_biz_ref ON public.refund_items (business_id, refund_id);
CREATE INDEX IF NOT EXISTS idx_inv_items_biz_name ON public.inventory_items (business_id, name);
CREATE INDEX IF NOT EXISTS idx_inv_cats_biz_name ON public.inventory_categories (business_id, name);
CREATE INDEX IF NOT EXISTS idx_products_biz_sku ON public.products (business_id, sku);
CREATE INDEX IF NOT EXISTS idx_expenses_biz_date ON public.expenses (business_id, expense_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_biz_created ON public.audit_logs (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_biz_status ON public.cash_sessions (business_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_employees_biz_name ON public.employees (business_id, full_name);
CREATE INDEX IF NOT EXISTS idx_attendance_biz_date ON public.attendance (business_id, work_date, employee_id);
CREATE INDEX IF NOT EXISTS idx_daily_closings_biz_date ON public.daily_closings (business_id, closing_date DESC);
CREATE INDEX IF NOT EXISTS idx_pos_papers_biz ON public.pos_print_papers (business_id, name);
CREATE INDEX IF NOT EXISTS idx_pos_media_biz ON public.pos_media_categories (business_id, name);
CREATE INDEX IF NOT EXISTS idx_pos_composing_biz ON public.pos_composing_services (business_id, name);
