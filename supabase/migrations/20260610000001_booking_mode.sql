-- Phase 11C: Pool booking mode
-- Seed booking_mode into industry templates (idempotent).
UPDATE industry_templates SET feature_flags = feature_flags || '{"booking_mode": "staff_select"}'::jsonb
WHERE slug = 'adult_services' AND NOT (feature_flags ? 'booking_mode');

UPDATE industry_templates SET feature_flags = feature_flags || '{"booking_mode": "staff_select"}'::jsonb
WHERE slug = 'tattoo' AND NOT (feature_flags ? 'booking_mode');

UPDATE industry_templates SET feature_flags = feature_flags || '{"booking_mode": "staff_select"}'::jsonb
WHERE slug = 'consultancy' AND NOT (feature_flags ? 'booking_mode');

UPDATE industry_templates SET feature_flags = feature_flags || '{"booking_mode": "pool"}'::jsonb
WHERE slug = 'beauty_copy' AND NOT (feature_flags ? 'booking_mode');

UPDATE industry_templates SET feature_flags = feature_flags || '{"booking_mode": "staff_select"}'::jsonb
WHERE slug = 'custom' AND NOT (feature_flags ? 'booking_mode');

-- Catch-all: any remaining template defaults to staff_select.
UPDATE industry_templates SET feature_flags = feature_flags || '{"booking_mode": "staff_select"}'::jsonb
WHERE NOT (feature_flags ? 'booking_mode');

-- Backfill existing tenant_config rows.
UPDATE tenant_config SET feature_flags = feature_flags || '{"booking_mode": "staff_select"}'::jsonb
WHERE NOT (feature_flags ? 'booking_mode');
