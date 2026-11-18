-- ============================================================================
-- Migration 004: Performance Composite & Partial Indexes
-- Eliminates sequential table scans as transactional history grows.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sales_biz_created_desc
  ON public.sales (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_biz_status_created
  ON public.sales (business_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sale_items_biz_sale
  ON public.sale_items (business_id, sale_id);

CREATE INDEX IF NOT EXISTS idx_payments_biz_sale
  ON public.payments (business_id, sale_id);

CREATE INDEX IF NOT EXISTS idx_expenses_biz_created_desc
  ON public.expenses (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_biz_date
  ON public.expenses (business_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_account_movements_biz_created
  ON public.account_movements (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_items_biz_name
  ON public.inventory_items (business_id, name);

CREATE INDEX IF NOT EXISTS idx_inventory_lots_fifo
  ON public.inventory_lots (business_id, product_id, received_at ASC)
  WHERE remaining_qty > 0;

CREATE INDEX IF NOT EXISTS idx_cash_sessions_biz_opened
  ON public.cash_sessions (business_id, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_biz_open
  ON public.cash_sessions (business_id, status, opened_at ASC)
  WHERE status = 'OPEN';

CREATE INDEX IF NOT EXISTS idx_audit_logs_biz_created
  ON public.audit_logs (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_biz_action_created
  ON public.audit_logs (business_id, action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_biz_date
  ON public.attendance (business_id, work_date);

CREATE INDEX IF NOT EXISTS idx_leaves_biz_created
  ON public.leaves (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_biz_name
  ON public.customers (business_id, name);

CREATE INDEX IF NOT EXISTS idx_customer_ledger_biz_cust
  ON public.customer_ledger (business_id, customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_closings_biz_date
  ON public.daily_closings (business_id, closing_date DESC);

ANALYZE;
