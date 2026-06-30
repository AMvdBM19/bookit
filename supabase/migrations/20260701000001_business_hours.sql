-- Phase 22-C1: Business working hours (tenant-level availability gate)
-- business_hours_enabled on tenant_settings gates the feature (default OFF).
-- business_hours table stores per-tenant weekly hours (one row per open day).

ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS business_hours_enabled BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sunday
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, day_of_week)
);

ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON business_hours
  USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

CREATE POLICY service_role_all ON business_hours
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
