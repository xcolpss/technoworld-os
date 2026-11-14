CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  customer_type TEXT NOT NULL DEFAULT 'REGULAR' CHECK (customer_type IN ('REGULAR', 'CORPORATE', 'SCHOOL', 'VIP')),
  credit_limit_paisa BIGINT DEFAULT 5000000,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_business ON public.customers (business_id, name);

CREATE TABLE IF NOT EXISTS public.customer_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('CREDIT_SALE', 'REPAYMENT', 'ADJUSTMENT')),
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
  payment_method TEXT,
  notes TEXT,
  recorded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_ledger_cust ON public.customer_ledger (customer_id, created_at DESC);