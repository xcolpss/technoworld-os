-- ============================================================================
-- TECHNOWORLD OS — MIGRATION 0004
-- Domains: Governance & Immutable Audit, Offline Sync, Reporting, Settings
-- Monetary Precision: Integer Paisa (BIGINT, 1 PKR = 100 paisa)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 10. GOVERNANCE AND AUDIT
-- ----------------------------------------------------------------------------

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  actor_profile_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  terminal_id UUID REFERENCES public.terminals(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  before_state JSONB,
  after_state JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX idx_audit_logs_business_created ON public.audit_logs(business_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- Enforce strict immutability on audit_logs (never allow UPDATE or DELETE)
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are strictly immutable and cannot be modified or deleted.';
END;
$$;

CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

CREATE TABLE public.approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  rule_code TEXT NOT NULL,
  name TEXT NOT NULL,
  threshold_paisa BIGINT NOT NULL DEFAULT 0 CHECK (threshold_paisa >= 0),
  required_role_code TEXT NOT NULL DEFAULT 'OWNER' CHECK (required_role_code IN ('OWNER', 'MANAGER')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, rule_code)
);

CREATE TRIGGER trg_approval_rules_updated_at
  BEFORE UPDATE ON public.approval_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  approval_rule_id UUID REFERENCES public.approval_rules(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  decided_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX idx_approval_requests_business_status ON public.approval_requests(business_id, status);

CREATE TRIGGER trg_approval_requests_updated_at
  BEFORE UPDATE ON public.approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_payload JSONB,
  status TEXT NOT NULL DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, idempotency_key)
);

CREATE INDEX idx_idempotency_keys_expires ON public.idempotency_keys(expires_at);

CREATE TRIGGER trg_idempotency_keys_updated_at
  BEFORE UPDATE ON public.idempotency_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 11. OFFLINE SYNCHRONIZATION
-- ----------------------------------------------------------------------------

CREATE TABLE public.sync_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  terminal_id UUID REFERENCES public.terminals(id) ON DELETE SET NULL,
  device_fingerprint TEXT NOT NULL,
  device_label TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, device_fingerprint)
);

CREATE TRIGGER trg_sync_devices_updated_at
  BEFORE UPDATE ON public.sync_devices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sync_device_id UUID NOT NULL REFERENCES public.sync_devices(id) ON DELETE CASCADE,
  client_op_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'APPLIED', 'CONFLICT', 'FAILED')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, client_op_id)
);

CREATE INDEX idx_sync_queue_status ON public.sync_queue(business_id, status);

CREATE TRIGGER trg_sync_queue_updated_at
  BEFORE UPDATE ON public.sync_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sync_queue_id UUID NOT NULL REFERENCES public.sync_queue(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  local_payload JSONB NOT NULL,
  server_payload JSONB NOT NULL,
  resolution_status TEXT NOT NULL DEFAULT 'UNRESOLVED' CHECK (resolution_status IN ('UNRESOLVED', 'RESOLVED_LOCAL', 'RESOLVED_SERVER', 'MERGED')),
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER trg_sync_conflicts_updated_at
  BEFORE UPDATE ON public.sync_conflicts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sync_device_id UUID NOT NULL REFERENCES public.sync_devices(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('PUSH', 'PULL', 'CONFLICT_DETECTED', 'RECONCILED')),
  records_processed INTEGER NOT NULL DEFAULT 0 CHECK (records_processed >= 0),
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX idx_sync_events_device ON public.sync_events(sync_device_id, created_at DESC);

CREATE TRIGGER trg_sync_events_updated_at
  BEFORE UPDATE ON public.sync_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 12. REPORTING
-- ----------------------------------------------------------------------------

CREATE TABLE public.saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_owner_only BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER trg_saved_reports_updated_at
  BEFORE UPDATE ON public.saved_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.daily_report_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  gross_sales_paisa BIGINT NOT NULL DEFAULT 0,
  refunds_paisa BIGINT NOT NULL DEFAULT 0,
  net_sales_paisa BIGINT NOT NULL DEFAULT 0,
  expenses_paisa BIGINT NOT NULL DEFAULT 0,
  cash_collected_paisa BIGINT NOT NULL DEFAULT 0,
  digital_collected_paisa BIGINT NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  generated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (business_id, snapshot_date)
);

CREATE TRIGGER trg_daily_report_snapshots_updated_at
  BEFORE UPDATE ON public.daily_report_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.report_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  exported_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  report_type TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('PDF', 'CSV', 'XLSX')),
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('QUEUED', 'COMPLETED', 'FAILED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER trg_report_exports_updated_at
  BEFORE UPDATE ON public.report_exports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 13. SETTINGS
-- ----------------------------------------------------------------------------

CREATE TABLE public.business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  morning_shift_start TIME NOT NULL DEFAULT '08:00:00',
  morning_shift_end TIME NOT NULL DEFAULT '16:00:00',
  evening_shift_start TIME NOT NULL DEFAULT '16:00:00',
  evening_shift_end TIME NOT NULL DEFAULT '00:00:00',
  require_shift_open_for_sales BOOLEAN NOT NULL DEFAULT TRUE,
  allow_negative_stock BOOLEAN NOT NULL DEFAULT FALSE,
  tax_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  default_tax_bps INTEGER NOT NULL DEFAULT 0 CHECK (default_tax_bps BETWEEN 0 AND 10000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER trg_business_settings_updated_at
  BEFORE UPDATE ON public.business_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.receipt_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  header_title TEXT NOT NULL DEFAULT 'TechnoWorld',
  header_subtitle TEXT,
  phone_line TEXT,
  address_line TEXT,
  footer_message TEXT NOT NULL DEFAULT 'Thank you for visiting TechnoWorld!',
  show_cashier_name BOOLEAN NOT NULL DEFAULT TRUE,
  show_terminal_code BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER trg_receipt_settings_updated_at
  BEFORE UPDATE ON public.receipt_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.printer_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  terminal_id UUID NOT NULL UNIQUE REFERENCES public.terminals(id) ON DELETE CASCADE,
  paper_width_mm INTEGER NOT NULL DEFAULT 80 CHECK (paper_width_mm IN (58, 80)),
  connection_type TEXT NOT NULL DEFAULT 'USB' CHECK (connection_type IN ('USB', 'NETWORK', 'BROWSER_PRINT')),
  printer_identifier TEXT,
  auto_cut_paper BOOLEAN NOT NULL DEFAULT TRUE,
  kick_cash_drawer_on_cash_sale BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER trg_printer_settings_updated_at
  BEFORE UPDATE ON public.printer_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  notify_low_stock BOOLEAN NOT NULL DEFAULT TRUE,
  notify_cash_discrepancy BOOLEAN NOT NULL DEFAULT TRUE,
  notify_large_refund BOOLEAN NOT NULL DEFAULT TRUE,
  large_refund_threshold_paisa BIGINT NOT NULL DEFAULT 500000 CHECK (large_refund_threshold_paisa >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER trg_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
