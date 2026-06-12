-- Phase 14-A9: currency and base rate become tenant-editable.
-- base_rate_per_30min was never actually inserted into the lock table
-- (it was only excluded from the settings PATCH allowlist), but it is
-- included here so the unlock is complete and idempotent either way.
DELETE FROM tenant_locked_settings
WHERE field_name IN ('currency', 'base_rate_per_30min');
