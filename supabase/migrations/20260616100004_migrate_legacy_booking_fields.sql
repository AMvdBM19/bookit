-- Phase 20-C2: migrate the two legacy hardcoded booking fields into
-- builder-managed booking_fields rows. The legacy feature flags become inert
-- but stay in the type contract; bookings.service_address and
-- bookings.reference_image_url remain the storage columns for these keys.

-- Migrate booking_address_field → booking_fields row
INSERT INTO booking_fields (tenant_id, field_key, label, field_type, required, display_order)
SELECT t.id, 'service_address', 'Service address', 'address', true, 0
FROM tenants t
JOIN tenant_config tc ON tc.tenant_id = t.id
WHERE tc.feature_flags->>'booking_address_field' = 'true'
ON CONFLICT (tenant_id, field_key) DO NOTHING;

-- Migrate booking_reference_image → booking_fields row
INSERT INTO booking_fields (tenant_id, field_key, label, field_type, required, display_order)
SELECT t.id, 'reference_image', 'Reference image', 'file', false, 1
FROM tenants t
JOIN tenant_config tc ON tc.tenant_id = t.id
WHERE tc.feature_flags->>'booking_reference_image' = 'true'
ON CONFLICT (tenant_id, field_key) DO NOTHING;
