-- Phase 11A — Booking status lifecycle
-- Adds a booking source column and seeds the booking_completion_by feature flag
-- into existing industry templates and tenant configs.

-- a) Origin of the booking: widget (client-facing) or manual (admin-created).
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'widget'
  CHECK (source IN ('widget', 'manual'));
COMMENT ON COLUMN bookings.source IS 'Origin of the booking: widget (client-facing) or manual (admin-created)';

-- b) Seed booking_completion_by into existing industry templates (idempotent).
UPDATE industry_templates SET feature_flags = feature_flags || '{"booking_completion_by": "admin_only"}'::jsonb
WHERE slug = 'adult_services' AND NOT (feature_flags ? 'booking_completion_by');

UPDATE industry_templates SET feature_flags = feature_flags || '{"booking_completion_by": "staff_and_admin"}'::jsonb
WHERE slug = 'tattoo' AND NOT (feature_flags ? 'booking_completion_by');

UPDATE industry_templates SET feature_flags = feature_flags || '{"booking_completion_by": "staff_and_admin"}'::jsonb
WHERE slug = 'consultancy' AND NOT (feature_flags ? 'booking_completion_by');

UPDATE industry_templates SET feature_flags = feature_flags || '{"booking_completion_by": "admin_only"}'::jsonb
WHERE slug = 'custom' AND NOT (feature_flags ? 'booking_completion_by');

-- Backfill any existing tenant_config rows that predate the flag.
UPDATE tenant_config SET feature_flags = feature_flags || '{"booking_completion_by": "admin_only"}'::jsonb
WHERE NOT (feature_flags ? 'booking_completion_by');
