-- Phase 21-D4: Terms & privacy consent on booking widget.

-- Terms/privacy URLs on tenant settings (displayed in widget footer / checkbox)
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS terms_url TEXT NULL;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS privacy_url TEXT NULL;

-- Record when the client accepted terms at booking time
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ NULL;
