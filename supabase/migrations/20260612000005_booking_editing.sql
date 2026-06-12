-- Phase 15-B7: booking editing (agent always, staff behind a feature flag)
-- with a per-edit audit trail.

-- 1. Edited marker for the "Edited" badge in lists.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ NULL;

-- 2. Audit trail: one row per saved edit, changes as {field: {from, to}}.
CREATE TABLE IF NOT EXISTS booking_edits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  edited_by_role  TEXT NOT NULL CHECK (edited_by_role IN ('agent', 'staff')),
  edited_by_id    UUID NULL,
  edited_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  changes         JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_booking_edits_booking ON booking_edits(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_edits_tenant ON booking_edits(tenant_id);

ALTER TABLE booking_edits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON booking_edits;
CREATE POLICY tenant_isolation ON booking_edits
  USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

-- 3. staff_can_edit_bookings feature flag, default false everywhere.
UPDATE industry_templates
  SET feature_flags = feature_flags || '{"staff_can_edit_bookings": false}'::jsonb,
      updated_at = NOW()
  WHERE NOT (feature_flags ? 'staff_can_edit_bookings');

UPDATE tenant_config
  SET feature_flags = feature_flags || '{"staff_can_edit_bookings": false}'::jsonb,
      updated_at = NOW()
  WHERE NOT (feature_flags ? 'staff_can_edit_bookings');
