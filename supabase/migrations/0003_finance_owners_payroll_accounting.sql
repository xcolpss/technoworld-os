-- ============================================================================
-- TECHNOWORLD OS — MIGRATION 0003
-- Domains: Finance & Expenses, Owner Capital Accounts, Payroll, Double-Entry Accounting
-- Monetary Precision: Integer Paisa (BIGINT, 1 PKR = 100 paisa)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 6. FINANCE AND EXPENSES
-- ----------------------------------------------------------------------------

CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('CASH_DRAWER', 'VAULT_CASH', 'BANK', 'MOBILE_WALLET', 'OTHER')),
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  current_balance_paisa BIGINT NOT NULL DEFAULT 0,
  is_owner_restricted BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FROZEN', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, code)
);

CREATE INDEX idx_accounts_business ON public.accounts(business_id);

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.account_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  from_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  to_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  reference_note TEXT,
  status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('PENDING', 'POSTED', 'REVERSED')),
  initiated_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CHECK (from_account_id <> to_account_id)
);

CREATE INDEX idx_account_transfers_business ON public.account_transfers(business_id, transferred_at DESC);

CREATE TRIGGER trg_account_transfers_updated_at
  BEFORE UPDATE ON public.account_transfers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  cash_session_id UUID REFERENCES public.cash_sessions(id) ON DELETE RESTRICT,
  direction TEXT NOT NULL CHECK (direction IN ('IN', 'OUT')),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('SALE_RECEIPT', 'REFUND_PAYOUT', 'EXPENSE_PAYOUT', 'FLOAT_IN', 'DROP_OUT', 'TRANSFER', 'OWNER_TX', 'SALARY_PAYOUT')),
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  reference_type TEXT NOT NULL,
  reference_id UUID NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX idx_cash_movements_account ON public.cash_movements(account_id, occurred_at DESC);
CREATE INDEX idx_cash_movements_session ON public.cash_movements(cash_session_id);

CREATE TRIGGER trg_cash_movements_updated_at
  BEFORE UPDATE ON public.cash_movements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  requires_owner_approval BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, code)
);

CREATE TRIGGER trg_expense_categories_updated_at
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  expense_category_id UUID NOT NULL REFERENCES public.expense_categories(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE RESTRICT,
  cash_session_id UUID REFERENCES public.cash_sessions(id) ON DELETE RESTRICT,
  expense_number TEXT NOT NULL,
  vendor_or_payee TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('PENDING_APPROVAL', 'POSTED', 'REJECTED', 'REVERSED')),
  recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  incurred_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, expense_number)
);

CREATE INDEX idx_expenses_business ON public.expenses(business_id, incurred_at DESC);

CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 7. OWNER ACCOUNTS (CONFIDENTIAL — OWNER ROLE ACCESS ONLY)
-- ----------------------------------------------------------------------------

CREATE TABLE public.owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  display_name TEXT NOT NULL,
  equity_share_bps INTEGER NOT NULL DEFAULT 0 CHECK (equity_share_bps BETWEEN 0 AND 10000),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, profile_id)
);

CREATE TRIGGER trg_owners_updated_at
  BEFORE UPDATE ON public.owners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.owner_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  contributed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'REVERSED')),
  recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER trg_owner_contributions_updated_at
  BEFORE UPDATE ON public.owner_contributions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.owner_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  direction TEXT NOT NULL CHECK (direction IN ('OWNER_TO_BUSINESS', 'BUSINESS_TO_OWNER')),
  principal_paisa BIGINT NOT NULL CHECK (principal_paisa > 0),
  remaining_paisa BIGINT NOT NULL CHECK (remaining_paisa >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'SETTLED', 'REVERSED')),
  recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER trg_owner_loans_updated_at
  BEFORE UPDATE ON public.owner_loans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.owner_loan_repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  owner_loan_id UUID NOT NULL REFERENCES public.owner_loans(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  repaid_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'REVERSED')),
  recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER trg_owner_loan_repayments_updated_at
  BEFORE UPDATE ON public.owner_loan_repayments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.owner_drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  drawn_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'REVERSED')),
  recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER trg_owner_drawings_updated_at
  BEFORE UPDATE ON public.owner_drawings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.owner_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  period_label TEXT NOT NULL,
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  distributed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'REVERSED')),
  recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER trg_owner_distributions_updated_at
  BEFORE UPDATE ON public.owner_distributions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 8. PAYROLL
-- ----------------------------------------------------------------------------

CREATE TABLE public.payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  period_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FINALIZED', 'PAID')),
  finalized_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, start_date, end_date),
  CHECK (end_date >= start_date)
);

CREATE TRIGGER trg_payroll_periods_updated_at
  BEFORE UPDATE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  payroll_period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  gross_pay_paisa BIGINT NOT NULL CHECK (gross_pay_paisa >= 0),
  bonuses_paisa BIGINT NOT NULL DEFAULT 0 CHECK (bonuses_paisa >= 0),
  deductions_paisa BIGINT NOT NULL DEFAULT 0 CHECK (deductions_paisa >= 0),
  advance_recovery_paisa BIGINT NOT NULL DEFAULT 0 CHECK (advance_recovery_paisa >= 0),
  net_pay_paisa BIGINT NOT NULL CHECK (net_pay_paisa >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'PAID')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (payroll_period_id, employee_id)
);

CREATE TRIGGER trg_payroll_items_updated_at
  BEFORE UPDATE ON public.payroll_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.salary_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
  remaining_paisa BIGINT NOT NULL CHECK (remaining_paisa >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  approved_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RECOVERED', 'REVERSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER trg_salary_advances_updated_at
  BEFORE UPDATE ON public.salary_advances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.salary_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  payroll_item_id UUID NOT NULL REFERENCES public.payroll_items(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  paid_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  paid_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reference_note TEXT,
  status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'REVERSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER trg_salary_payments_updated_at
  BEFORE UPDATE ON public.salary_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 9. DOUBLE-ENTRY ACCOUNTING
-- ----------------------------------------------------------------------------

CREATE TABLE public.chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL,
  name TEXT NOT NULL,
  root_type TEXT NOT NULL CHECK (root_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('DEBIT', 'CREDIT')),
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, account_code)
);

CREATE TRIGGER trg_chart_of_accounts_updated_at
  BEFORE UPDATE ON public.chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.fiscal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  period_code TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'LOCKED')),
  closed_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, period_code),
  CHECK (end_date >= start_date)
);

CREATE TRIGGER trg_fiscal_periods_updated_at
  BEFORE UPDATE ON public.fiscal_periods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  fiscal_period_id UUID REFERENCES public.fiscal_periods(id) ON DELETE RESTRICT,
  entry_number TEXT NOT NULL,
  entry_date DATE NOT NULL,
  description TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  reversal_of_id UUID REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'POSTED', 'REVERSED')),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, entry_number)
);

CREATE INDEX idx_journal_entries_business_date ON public.journal_entries(business_id, entry_date DESC);

CREATE TRIGGER trg_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  coa_account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  debit_paisa BIGINT NOT NULL DEFAULT 0 CHECK (debit_paisa >= 0),
  credit_paisa BIGINT NOT NULL DEFAULT 0 CHECK (credit_paisa >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CHECK (
    (debit_paisa > 0 AND credit_paisa = 0) OR
    (credit_paisa > 0 AND debit_paisa = 0)
  )
);

CREATE INDEX idx_journal_lines_entry ON public.journal_lines(journal_entry_id);

CREATE TRIGGER trg_journal_lines_updated_at
  BEFORE UPDATE ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enforce balanced double-entry ledger whenever a journal entry is POSTED
CREATE OR REPLACE FUNCTION public.verify_journal_entry_balanced()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_debit BIGINT;
  v_total_credit BIGINT;
  v_line_count INTEGER;
BEGIN
  IF NEW.status = 'POSTED' THEN
    SELECT
      COALESCE(SUM(debit_paisa), 0),
      COALESCE(SUM(credit_paisa), 0),
      COUNT(*)
    INTO v_total_debit, v_total_credit, v_line_count
    FROM public.journal_lines
    WHERE journal_entry_id = NEW.id;

    IF v_line_count < 2 THEN
      RAISE EXCEPTION 'Posted journal entry % must contain at least 2 lines.', NEW.id;
    END IF;

    IF v_total_debit <= 0 OR v_total_debit <> v_total_credit THEN
      RAISE EXCEPTION 'Unbalanced journal entry %: debits (%) must equal credits (%).',
        NEW.id, v_total_debit, v_total_credit;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_journal_entry_balanced
  BEFORE INSERT OR UPDATE OF status ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.verify_journal_entry_balanced();
