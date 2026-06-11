-- Phase: Tier 1 polish sprint, Group 7 — buffer time around bookings.
-- Buffers expand each existing booking's blocked range in the availability engine.

ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS buffer_before_minutes INTEGER DEFAULT 0;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS buffer_after_minutes INTEGER DEFAULT 0;
