-- Phase 20-A2: reschedule audit fields on bookings.
-- rescheduled_at = timestamp of the most recent reschedule;
-- reschedule_count drives the "Rescheduled" badge in the dashboard.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMPTZ NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reschedule_count INTEGER NOT NULL DEFAULT 0;
