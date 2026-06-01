-- Phase 3 fixes: guest_clients additions, guest_blocks column renames, seed_tags cleanup

-- Fix guest_clients: add first_seen_at, notes
ALTER TABLE guest_clients
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Fix guest_blocks: rename columns to match spec
ALTER TABLE guest_blocks
  RENAME COLUMN blocked_by_agent_id TO blocked_by;
ALTER TABLE guest_blocks
  RENAME COLUMN created_at TO blocked_at;

-- Add UNIQUE constraint on guest_blocks
ALTER TABLE guest_blocks
  ADD CONSTRAINT guest_blocks_tenant_email_unique UNIQUE (tenant_id, email);

-- Fix seed_tags: adult_services — ensure Escort exists, remove Overnight
INSERT INTO service_tags (tenant_id, name, extra_price, display_order)
SELECT '22222222-2222-2222-2222-222222222222', 'Escort', 0.00, 0
WHERE NOT EXISTS (
  SELECT 1 FROM service_tags
  WHERE tenant_id = '22222222-2222-2222-2222-222222222222' AND name = 'Escort'
);

DELETE FROM service_tags
WHERE tenant_id = '22222222-2222-2222-2222-222222222222' AND name = 'Overnight';
