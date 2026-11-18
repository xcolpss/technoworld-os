-- Allow historical sales imported from Supabase where shift_id held cash_session_id
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_shift_id_fkey;
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_sold_by_fkey;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_received_by_fkey;
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_recorded_by_fkey;
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_created_by_fkey;
