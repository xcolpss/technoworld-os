-- ============================================================================
-- TECHNOWORLD OS — DEVELOPMENT ENVIRONMENT SEED ONLY
-- WARNING: Never run fabricated sales/financial data into production.
-- Populates system permission definitions only.
-- ============================================================================

INSERT INTO public.permissions (code, module, description) VALUES
  ('pos.sale.create', 'POS', 'Create and post customer sales'),
  ('pos.discount.apply', 'POS', 'Apply permitted line or cart discounts'),
  ('pos.refund.create', 'POS', 'Issue permitted customer refunds'),
  ('shift.session.manage', 'SHIFTS', 'Open, close, and handover shift cash sessions'),
  ('expense.create', 'EXPENSES', 'Record operational shop expenses'),
  ('inventory.manage', 'INVENTORY', 'Manage products, purchases, and stock adjustments'),
  ('employee.manage', 'EMPLOYEES', 'Manage staff profiles and shift attendance'),
  ('payroll.manage', 'PAYROLL', 'Prepare and finalize staff payroll periods'),
  ('finance.accounts.manage', 'FINANCE', 'Manage bank/vault accounts and transfers'),
  ('owner.capital.access', 'OWNER', 'Access confidential owner equity, loans, and drawings'),
  ('audit.view', 'GOVERNANCE', 'Inspect immutable system audit logs'),
  ('settings.manage', 'SETTINGS', 'Configure business, receipt, printer, and role settings')
ON CONFLICT (code) DO NOTHING;
