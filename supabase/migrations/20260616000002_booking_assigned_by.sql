-- Phase 19 A4: track who assigned the staff member to a booking, so staff can
-- be blocked from cancelling bookings an administrator assigned to them.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_by TEXT NULL
  CHECK (assigned_by IN ('client', 'staff_claim', 'agent_assign', 'auto'));

-- Backfill existing bookings
UPDATE bookings SET assigned_by = 'agent_assign' WHERE source = 'manual' AND status = 'confirmed' AND assigned_by IS NULL;
UPDATE bookings SET assigned_by = 'client' WHERE source = 'widget' AND staff_id IS NOT NULL AND status = 'confirmed' AND assigned_by IS NULL;
