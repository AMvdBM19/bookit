-- Add JSONB config column to tenant_integrations for provider-specific settings
ALTER TABLE tenant_integrations
  ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN tenant_integrations.config IS
  'Provider-specific config. Twilio: {}. Meta: { "phone_number_id": "...", "waba_id": "..." }';
