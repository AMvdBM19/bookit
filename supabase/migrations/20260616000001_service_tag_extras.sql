-- Phase 19 A2: configurable slot blocking + quantity on service tags.
-- blocks_slot=false → tag adds extra_price but no time; when ALL selected tags
-- are non-blocking the booking falls back to default_slot_minutes.
-- allow_quantity + max_quantity → client can select a tag 1..N times; extra_price
-- is multiplied by the chosen quantity (stored on booking_service_tags.quantity).
ALTER TABLE service_tags ADD COLUMN IF NOT EXISTS blocks_slot BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE service_tags ADD COLUMN IF NOT EXISTS allow_quantity BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE service_tags ADD COLUMN IF NOT EXISTS max_quantity INTEGER NOT NULL DEFAULT 1;
ALTER TABLE booking_service_tags ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
