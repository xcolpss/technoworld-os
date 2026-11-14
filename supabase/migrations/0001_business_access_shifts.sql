-- ============================================================================
-- TECHNOWORLD OS — MIGRATION 0001
-- Domains: Business & Access Control, Employees & Shift Cash Sessions
-- Monetary Precision: Integer Paisa (BIGINT, 1 PKR = 100 paisa)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Automatic updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1. BUSINESS AND ACCESS
-- ----------------------------------------------------------------------------

CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  city TEXT NOT NULL DEFAULT 'Rawalpindi',
  country TEXT NOT NULL DEFAULT 'Pakistan',
  default_currency CHAR(3) NOT NULL DEFAULT 'PKR',
  timezone TEXT NOT NULL DEFAULT 'Asia/Karachi',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER trg_businesses_updated_at
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'LOCKED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK (code IN ('OWNER', 'MANAGER', 'EMPLOYEE')),
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, code)
);

CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  module TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (role_id, permission_id)
);

CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INVITED', 'SUSPENDED', 'REVOKED')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, profile_id)
);

CREATE INDEX idx_memberships_profile ON public.memberships(profile_id);
CREATE INDEX idx_memberships_business ON public.memberships(business_id);

CREATE TRIGGER trg_memberships_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.terminals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  location_label TEXT,
  has_receipt_printer BOOLEAN NOT NULL DEFAULT FALSE,
  has_cash_drawer BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'RETIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, code)
);

CREATE INDEX idx_terminals_business ON public.terminals(business_id);

CREATE TRIGGER trg_terminals_updated_at
  BEFORE UPDATE ON public.terminals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. EMPLOYEES AND SHIFTS
-- ----------------------------------------------------------------------------

CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  employee_code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  cnic_last4 CHAR(4),
  designation TEXT NOT NULL,
  assigned_shift TEXT NOT NULL DEFAULT 'MORNING' CHECK (assigned_shift IN ('MORNING', 'EVENING', 'ROTATIONAL')),
  hire_date DATE NOT NULL,
  termination_date DATE,
  max_discount_bps INTEGER NOT NULL DEFAULT 0 CHECK (max_discount_bps BETWEEN 0 AND 10000),
  can_issue_refunds BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ON_LEAVE', 'TERMINATED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, employee_code)
);

CREATE INDEX idx_employees_business ON public.employees(business_id);
CREATE INDEX idx_employees_profile ON public.employees(profile_id);

CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.employee_compensation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  pay_type TEXT NOT NULL CHECK (pay_type IN ('MONTHLY', 'DAILY', 'HOURLY')),
  base_amount_paisa BIGINT NOT NULL CHECK (base_amount_paisa >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  effective_from DATE NOT NULL,
  effective_to DATE,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX idx_emp_comp_employee ON public.employee_compensation_history(employee_id, effective_from DESC);

CREATE TRIGGER trg_emp_comp_updated_at
  BEFORE UPDATE ON public.employee_compensation_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  shift_window TEXT NOT NULL CHECK (shift_window IN ('MORNING', 'EVENING')),
  clock_in_at TIMESTAMPTZ,
  clock_out_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PRESENT' CHECK (status IN ('PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'LEAVE')),
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, employee_id, attendance_date, shift_window)
);

CREATE INDEX idx_attendance_business_date ON public.attendance(business_id, attendance_date DESC);

CREATE TRIGGER trg_attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  shift_window TEXT NOT NULL CHECK (shift_window IN ('MORNING', 'EVENING')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  opened_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  closed_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'VERIFIED')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, shift_date, shift_window)
);

CREATE INDEX idx_shifts_business_status ON public.shifts(business_id, status);

CREATE TRIGGER trg_shifts_updated_at
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE RESTRICT,
  terminal_id UUID NOT NULL REFERENCES public.terminals(id) ON DELETE RESTRICT,
  opened_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  closed_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  opening_float_paisa BIGINT NOT NULL DEFAULT 0 CHECK (opening_float_paisa >= 0),
  expected_closing_paisa BIGINT NOT NULL DEFAULT 0,
  counted_closing_paisa BIGINT,
  variance_paisa BIGINT,
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  closed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'DISCREPANCY_REVIEW')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX idx_cash_sessions_shift ON public.cash_sessions(shift_id);
CREATE INDEX idx_cash_sessions_terminal_status ON public.cash_sessions(terminal_id, status);

CREATE TRIGGER trg_cash_sessions_updated_at
  BEFORE UPDATE ON public.cash_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.shift_handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  from_shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE RESTRICT,
  to_shift_id UUID REFERENCES public.shifts(id) ON DELETE RESTRICT,
  cash_session_id UUID NOT NULL REFERENCES public.cash_sessions(id) ON DELETE RESTRICT,
  handed_over_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  accepted_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  cash_handed_paisa BIGINT NOT NULL CHECK (cash_handed_paisa >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DISPUTED')),
  notes TEXT,
  handed_over_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX idx_shift_handovers_business ON public.shift_handovers(business_id, handed_over_at DESC);

CREATE TRIGGER trg_shift_handovers_updated_at
  BEFORE UPDATE ON public.shift_handovers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
