ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS deposit_pct NUMERIC(5,2) DEFAULT 20.00,
  ADD COLUMN IF NOT EXISTS deposit_required_above_minutes INT DEFAULT 60;

COMMENT ON COLUMN tenant_settings.deposit_pct IS 'Percentage of total price required as deposit';
COMMENT ON COLUMN tenant_settings.deposit_required_above_minutes IS 'Require deposit for bookings longer than this many minutes. 0 = always required.';
