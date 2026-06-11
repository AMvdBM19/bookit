-- Phase: Tier 1 polish sprint, Group 6 — per-service duration.
-- duration_minutes NULL = tag has no own duration (falls back to default_slot_minutes).
-- per_service_duration_enabled gates the whole feature per tenant (default off).

ALTER TABLE service_tags ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT NULL;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS per_service_duration_enabled BOOLEAN DEFAULT FALSE;
