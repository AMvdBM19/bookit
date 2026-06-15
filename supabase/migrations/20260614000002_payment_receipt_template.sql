-- Phase 18-B1: payment receipt email template. Sent when a booking becomes
-- fully paid (terminal / full settlement). Distinct from payment_received,
-- which confirms a deposit. Seed one row per existing tenant; new tenants get
-- it from the super-admin create-tenant seeding.
INSERT INTO notification_templates (tenant_id, event_type, channel, subject, body)
SELECT
  t.id,
  'payment_receipt',
  'email',
  'Receipt — [agency_name]',
  E'Hi [client_name],\n\nThank you — your payment has been received.\n\nDate: [date] [time]\nWith: [staff_name]\nServices: [services]\n\nTotal: [total]\nPaid: [paid_amount] ([payment_method])\n[deposit_line]\n\nThis is a booking receipt, not a tax invoice.\n\n[agency_name]'
FROM tenants t
ON CONFLICT (tenant_id, event_type, channel) DO NOTHING;
