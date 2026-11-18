-- ============================================================================
-- Migration 005: Feature Updates
-- 1. Daily Closing Void audit fields (preserve records, exclude VOIDED from totals)
-- 2. Business Shift Schedule & Active Shift Override persistence
-- ============================================================================

ALTER TABLE public.daily_closings
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID,
  ADD COLUMN IF NOT EXISTS voided_by_name TEXT,
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_daily_closings_biz_status_date
  ON public.daily_closings (business_id, status, closing_date DESC);

CREATE TABLE IF NOT EXISTS public.shift_settings (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  morning_start TEXT NOT NULL DEFAULT '08:00',
  morning_end TEXT NOT NULL DEFAULT '16:00',
  evening_start TEXT NOT NULL DEFAULT '16:00',
  evening_end TEXT NOT NULL DEFAULT '00:00',
  override_shift TEXT CHECK (override_shift IS NULL OR override_shift IN ('MORNING', 'EVENING', 'NIGHT')),
  override_date DATE,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
