-- ============================================================================
-- TECHNOWORLD OS — MIGRATION 0002
-- Domains: Products & Services Catalog, Inventory Lots & Movements, Sales & Refunds
-- Monetary Precision: Integer Paisa (BIGINT, 1 PKR = 100 paisa)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3. PRODUCTS AND SERVICES
-- ----------------------------------------------------------------------------

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('PRODUCT', 'SERVICE', 'MIXED')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, slug)
);

CREATE INDEX idx_categories_business ON public.categories(business_id);

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  sku TEXT NOT NULL,
  barcode TEXT,
  name TEXT NOT NULL,
  description TEXT,
  unit_label TEXT NOT NULL DEFAULT 'piece',
  cost_price_paisa BIGINT NOT NULL DEFAULT 0 CHECK (cost_price_paisa >= 0),
  sale_price_paisa BIGINT NOT NULL CHECK (sale_price_paisa >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  track_inventory BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, sku)
);

CREATE INDEX idx_products_business ON public.products(business_id);
CREATE INDEX idx_products_barcode ON public.products(business_id, barcode) WHERE barcode IS NOT NULL;

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  service_code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  pricing_mode TEXT NOT NULL DEFAULT 'FIXED' CHECK (pricing_mode IN ('FIXED', 'PER_UNIT', 'CUSTOM_QUOTE')),
  default_price_paisa BIGINT NOT NULL DEFAULT 0 CHECK (default_price_paisa >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, service_code)
);

CREATE INDEX idx_services_business ON public.services(business_id);

CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX idx_suppliers_business ON public.suppliers(business_id);

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX idx_customers_business ON public.customers(business_id);
CREATE INDEX idx_customers_phone ON public.customers(business_id, phone) WHERE phone IS NOT NULL;

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. INVENTORY
-- ----------------------------------------------------------------------------

CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  purchase_number TEXT NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  subtotal_paisa BIGINT NOT NULL DEFAULT 0 CHECK (subtotal_paisa >= 0),
  discount_paisa BIGINT NOT NULL DEFAULT 0 CHECK (discount_paisa >= 0),
  total_paisa BIGINT NOT NULL DEFAULT 0 CHECK (total_paisa >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'RECEIVED', 'CANCELLED')),
  recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, purchase_number)
);

CREATE INDEX idx_purchases_business ON public.purchases(business_id, purchased_at DESC);

CREATE TRIGGER trg_purchases_updated_at
  BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost_paisa BIGINT NOT NULL CHECK (unit_cost_paisa >= 0),
  line_total_paisa BIGINT NOT NULL CHECK (line_total_paisa >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX idx_purchase_items_purchase ON public.purchase_items(purchase_id);

CREATE TRIGGER trg_purchase_items_updated_at
  BEFORE UPDATE ON public.purchase_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.inventory_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  purchase_item_id UUID REFERENCES public.purchase_items(id) ON DELETE SET NULL,
  lot_code TEXT NOT NULL,
  unit_cost_paisa BIGINT NOT NULL CHECK (unit_cost_paisa >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  initial_qty INTEGER NOT NULL CHECK (initial_qty >= 0),
  remaining_qty INTEGER NOT NULL CHECK (remaining_qty >= 0),
  received_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DEPLETED', 'EXPIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, lot_code)
);

CREATE INDEX idx_inventory_lots_product ON public.inventory_lots(product_id, received_at ASC);

CREATE TRIGGER trg_inventory_lots_updated_at
  BEFORE UPDATE ON public.inventory_lots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  inventory_lot_id UUID REFERENCES public.inventory_lots(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (reason IN ('DAMAGED', 'LOST', 'COUNT_CORRECTION', 'OPENING_STOCK', 'OTHER')),
  quantity_delta INTEGER NOT NULL CHECK (quantity_delta <> 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX idx_stock_adjustments_business ON public.stock_adjustments(business_id, created_at DESC);

CREATE TRIGGER trg_stock_adjustments_updated_at
  BEFORE UPDATE ON public.stock_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  inventory_lot_id UUID REFERENCES public.inventory_lots(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('PURCHASE_IN', 'SALE_OUT', 'REFUND_IN', 'ADJUSTMENT')),
  quantity_delta INTEGER NOT NULL CHECK (quantity_delta <> 0),
  unit_cost_paisa BIGINT NOT NULL DEFAULT 0 CHECK (unit_cost_paisa >= 0),
  reference_type TEXT NOT NULL,
  reference_id UUID NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id, created_at DESC);
CREATE INDEX idx_stock_movements_ref ON public.stock_movements(reference_type, reference_id);

CREATE TRIGGER trg_stock_movements_updated_at
  BEFORE UPDATE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. SALES AND REFUNDS
-- ----------------------------------------------------------------------------

CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE RESTRICT,
  cash_session_id UUID NOT NULL REFERENCES public.cash_sessions(id) ON DELETE RESTRICT,
  terminal_id UUID NOT NULL REFERENCES public.terminals(id) ON DELETE RESTRICT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  sold_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  receipt_number TEXT NOT NULL,
  client_tx_id UUID,
  subtotal_paisa BIGINT NOT NULL CHECK (subtotal_paisa >= 0),
  discount_paisa BIGINT NOT NULL DEFAULT 0 CHECK (discount_paisa >= 0),
  tax_paisa BIGINT NOT NULL DEFAULT 0 CHECK (tax_paisa >= 0),
  total_paisa BIGINT NOT NULL CHECK (total_paisa >= 0),
  paid_paisa BIGINT NOT NULL DEFAULT 0 CHECK (paid_paisa >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('DRAFT', 'POSTED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'VOIDED')),
  notes TEXT,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, receipt_number),
  UNIQUE (business_id, client_tx_id)
);

CREATE INDEX idx_sales_business_posted ON public.sales(business_id, posted_at DESC);
CREATE INDEX idx_sales_shift ON public.sales(shift_id);

CREATE TRIGGER trg_sales_updated_at
  BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  item_kind TEXT NOT NULL CHECK (item_kind IN ('PRODUCT', 'SERVICE', 'CUSTOM')),
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  service_id UUID REFERENCES public.services(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_paisa BIGINT NOT NULL CHECK (unit_price_paisa >= 0),
  discount_paisa BIGINT NOT NULL DEFAULT 0 CHECK (discount_paisa >= 0),
  line_total_paisa BIGINT NOT NULL CHECK (line_total_paisa >= 0),
  unit_cost_snapshot_paisa BIGINT NOT NULL DEFAULT 0 CHECK (unit_cost_snapshot_paisa >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CHECK (
    (item_kind = 'PRODUCT' AND product_id IS NOT NULL AND service_id IS NULL) OR
    (item_kind = 'SERVICE' AND service_id IS NOT NULL AND product_id IS NULL) OR
    (item_kind = 'CUSTOM' AND product_id IS NULL AND service_id IS NULL)
  )
);

CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);

CREATE TRIGGER trg_sale_items_updated_at
  BEFORE UPDATE ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
  cash_session_id UUID REFERENCES public.cash_sessions(id) ON DELETE RESTRICT,
  method TEXT NOT NULL CHECK (method IN ('CASH', 'BANK_TRANSFER', 'JAZZCASH', 'EASYPAISA', 'CARD', 'OTHER')),
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
  tendered_paisa BIGINT,
  change_paisa BIGINT DEFAULT 0 CHECK (change_paisa >= 0),
  reference_code TEXT,
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'REVERSED')),
  received_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX idx_payments_sale ON public.payments(sale_id);
CREATE INDEX idx_payments_session ON public.payments(cash_session_id);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE RESTRICT,
  cash_session_id UUID NOT NULL REFERENCES public.cash_sessions(id) ON DELETE RESTRICT,
  refund_number TEXT NOT NULL,
  reason TEXT NOT NULL,
  total_refund_paisa BIGINT NOT NULL CHECK (total_refund_paisa > 0),
  refund_method TEXT NOT NULL CHECK (refund_method IN ('CASH', 'BANK_TRANSFER', 'JAZZCASH', 'EASYPAISA')),
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('PENDING_APPROVAL', 'POSTED', 'REJECTED')),
  issued_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, refund_number)
);

CREATE INDEX idx_refunds_sale ON public.refunds(sale_id);

CREATE TRIGGER trg_refunds_updated_at
  BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.refund_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  refund_id UUID NOT NULL REFERENCES public.refunds(id) ON DELETE CASCADE,
  sale_item_id UUID NOT NULL REFERENCES public.sale_items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  refund_amount_paisa BIGINT NOT NULL CHECK (refund_amount_paisa >= 0),
  restock_inventory BOOLEAN NOT NULL DEFAULT FALSE,
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX idx_refund_items_refund ON public.refund_items(refund_id);

CREATE TRIGGER trg_refund_items_updated_at
  BEFORE UPDATE ON public.refund_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
