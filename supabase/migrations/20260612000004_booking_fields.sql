-- Phase 15-B5: conditional booking fields — client reference image + service
-- address, gated by two new feature flags.

-- 1. Booking columns. reference_image_url holds the storage object path
--    inside the booking-references bucket ({tenant_id}/{uuid}.{ext});
--    display goes through short-lived signed URLs, never public.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS reference_image_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS service_address TEXT NULL;

-- 2. Private bucket for client-uploaded reference images (signed URLs only).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('booking-references', 'booking-references', false, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Backfill the new feature flags into every template and tenant config so
--    the strict all-keys validator keeps passing. Reference image defaults on
--    for the tattoo template (and tenants stamped from it); everything else
--    gets false. booking_address_field starts false everywhere.
UPDATE industry_templates
  SET feature_flags = feature_flags
    || jsonb_build_object(
      'booking_reference_image', (slug = 'tattoo'),
      'booking_address_field', false
    ),
    updated_at = NOW()
  WHERE NOT (feature_flags ? 'booking_reference_image');

UPDATE tenant_config
  SET feature_flags = feature_flags
    || jsonb_build_object(
      'booking_reference_image', (source_template_slug = 'tattoo'),
      'booking_address_field', false
    ),
    updated_at = NOW()
  WHERE NOT (feature_flags ? 'booking_reference_image');
