ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_payment_source_check;
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_payment_source_check
  CHECK (payment_source IN ('CASH_DRAWER', 'CASH_TILL', 'CASH_IN_HAND', 'OWNER_CASH', 'EASYPAISA', 'JAZZCASH', 'BANK_TRANSFER', 'BANK_WALLET'));

CREATE TABLE IF NOT EXISTS public.account_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  movement_kind TEXT NOT NULL CHECK (movement_kind IN ('TRANSFER', 'ADJUSTMENT')),
  from_account TEXT,
  to_account TEXT,
  amount_paisa BIGINT NOT NULL,
  reason TEXT NOT NULL,
  recorded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_movements_business
  ON public.account_movements (business_id, created_at DESC);