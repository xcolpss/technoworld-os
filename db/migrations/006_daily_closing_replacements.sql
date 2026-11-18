-- ============================================================================
-- Migration 006: Daily Closing Shift Tracking & Replacement Support
-- 1. Preserve VOIDED closing records permanently for audit history while
--    allowing a corrected replacement closing for the same date and shift.
-- 2. Prevent duplicate active (non-voided) closings per business/date/shift.
-- ============================================================================

ALTER TABLE public.daily_closings
  ADD COLUMN IF NOT EXISTS shift_label TEXT NOT NULL DEFAULT 'FULL_DAY',
  ADD COLUMN IF NOT EXISTS replaces_closing_id UUID REFERENCES public.daily_closings(id),
  ADD COLUMN IF NOT EXISTS prepared_by_name TEXT;

-- Drop old rigid UNIQUE (business_id, closing_date) constraint so VOIDED rows
-- are preserved alongside replacement closings.
DO $$
DECLARE
  v_conname text;
BEGIN
  FOR v_conname IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.daily_closings'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.daily_closings DROP CONSTRAINT IF EXISTS %I', v_conname);
  END LOOP;
END $$;

-- Enforce at most ONE active (non-voided) closing per (business, date, shift)
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_closings_active_unique
  ON public.daily_closings (business_id, closing_date, COALESCE(shift_label, 'FULL_DAY'))
  WHERE UPPER(COALESCE(status, 'SUBMITTED')) <> 'VOIDED';
