-- Phase 19 A6: enforce a default staff limit per tenant.
-- Safe approach: set max_staff to current count if > 5, otherwise 5
UPDATE tenant_settings ts SET max_staff = GREATEST(5, (
  SELECT COUNT(*) FROM staff s WHERE s.tenant_id = ts.tenant_id AND s.status = 'active'
));
ALTER TABLE tenant_settings ALTER COLUMN max_staff SET DEFAULT 5;
