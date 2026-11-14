CREATE TABLE IF NOT EXISTS public.terminals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_terminals_business ON public.terminals (business_id, code);

CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  terminal_id UUID NOT NULL REFERENCES public.terminals(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  opening_float_paisa BIGINT NOT NULL DEFAULT 0,
  expected_closing_paisa BIGINT NOT NULL DEFAULT 0,
  actual_closing_paisa BIGINT DEFAULT 0,
  variance_paisa BIGINT DEFAULT 0,
  notes TEXT,
  opened_by UUID NOT NULL,
  closed_by UUID,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_bus_status ON public.cash_sessions (business_id, status);