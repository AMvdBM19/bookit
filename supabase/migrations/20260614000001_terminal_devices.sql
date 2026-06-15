-- Phase 18-A1: POS terminal device registration. Tenants register their
-- physical Mollie PIN terminals so staff can charge a booking's balance to a
-- card reader at the counter. terminal_id is the Mollie terminal id (term_xxx).
CREATE TABLE IF NOT EXISTS terminal_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL DEFAULT 'PIN terminal',
  terminal_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_terminal_devices_tenant ON terminal_devices(tenant_id);

ALTER TABLE terminal_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY terminal_devices_tenant ON terminal_devices
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY terminal_devices_service ON terminal_devices
  FOR ALL TO service_role USING (true) WITH CHECK (true);
