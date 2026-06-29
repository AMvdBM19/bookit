-- Phase 20-C1: tenant-defined custom booking fields.
-- Each row is one field on a tenant's booking form; bookings carry their
-- submitted values in bookings.custom_field_values (keyed by field_key).
CREATE TABLE IF NOT EXISTS booking_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN (
    'text','textarea','date','address','radio','checkbox','select','file'
  )),
  placeholder TEXT,
  help_text TEXT,
  required BOOLEAN NOT NULL DEFAULT false,
  options JSONB,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, field_key)
);

ALTER TABLE booking_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY booking_fields_tenant ON booking_fields
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);
CREATE POLICY booking_fields_service ON booking_fields
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS custom_field_values JSONB NOT NULL DEFAULT '{}'::jsonb;
