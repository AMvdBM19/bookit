-- Phase 10A: Industry Templates + Tenant Config
-- Replaces code-based VerticalConfig system with database-driven templates

-- 1. Create industry_templates table
CREATE TABLE industry_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,
  label           TEXT NOT NULL,
  description     TEXT,
  icon            TEXT DEFAULT '🏢',
  terminology     JSONB NOT NULL DEFAULT '{}'::jsonb,
  feature_flags   JSONB NOT NULL DEFAULT '{}'::jsonb,
  compliance_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  seed_tags       JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active       BOOLEAN DEFAULT true,
  is_system       BOOLEAN DEFAULT true,
  sort_order      INT DEFAULT 0,
  created_by      UUID,
  is_public       BOOLEAN DEFAULT true,
  is_premium      BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE industry_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_active_templates ON industry_templates
  FOR SELECT USING (is_active = true);

-- 2. Seed 4 system templates
INSERT INTO industry_templates (slug, label, icon, description, terminology, feature_flags, compliance_flags, default_settings, seed_tags, is_system, sort_order)
VALUES
  (
    'adult_services', 'Adult Services', '💋',
    'Escort agencies, adult entertainment. Full compliance: KVK, BSN, license, GDPR photo consent, age gate.',
    '{"staff":"Worker","staff_plural":"Workers","client":"Client","client_plural":"Clients","booking":"Booking","booking_plural":"Bookings","operator":"Agent","service_tag":"Service"}'::jsonb,
    '{"show_age_gate_step":true,"age_gate_minimum":18,"staff_require_pseudonym":true,"deposits_supported":false,"show_price_to_client":true,"require_booking_notes":false,"booking_notes_label":"Additional requests","booking_notes_placeholder":"Any special requests..."}'::jsonb,
    '{"show_kvk_field":true,"show_license_field":true,"show_bsn_on_staff":true,"show_gdpr_photo_consent":true,"require_terms_acceptance":true}'::jsonb,
    '{"client_mode":"account","booking_confirm_mode":"staff_must_accept","client_approval_mode":"manual","default_slot_minutes":60,"deposit_pct":0,"deposit_required_above_minutes":0}'::jsonb,
    '[{"name":"Escort"},{"name":"Massage"},{"name":"GFE"},{"name":"Dinner Date"}]'::jsonb,
    true, 1
  ),
  (
    'tattoo', 'Tattoo Shop', '🖊️',
    'Tattoo studios, piercing shops. Guest booking, deposits, style tags.',
    '{"staff":"Artist","staff_plural":"Artists","client":"Customer","client_plural":"Customers","booking":"Appointment","booking_plural":"Appointments","operator":"Manager","service_tag":"Style"}'::jsonb,
    '{"show_age_gate_step":true,"age_gate_minimum":18,"staff_require_pseudonym":false,"deposits_supported":true,"show_price_to_client":true,"require_booking_notes":true,"booking_notes_label":"Describe your piece","booking_notes_placeholder":"Style, size, placement, reference images..."}'::jsonb,
    '{"show_kvk_field":false,"show_license_field":false,"show_bsn_on_staff":false,"show_gdpr_photo_consent":false,"require_terms_acceptance":false}'::jsonb,
    '{"client_mode":"guest","booking_confirm_mode":"staff_must_accept","client_approval_mode":"auto","default_slot_minutes":60,"deposit_pct":20,"deposit_required_above_minutes":60}'::jsonb,
    '[{"name":"Traditional"},{"name":"Realism"},{"name":"Japanese"},{"name":"Neo-Traditional"},{"name":"Black & Grey"},{"name":"Colour"},{"name":"Minimalist"},{"name":"Lettering"},{"name":"Flash"},{"name":"Geometric"},{"name":"Watercolour"}]'::jsonb,
    true, 2
  ),
  (
    'consultancy', 'Consultancy', '💼',
    'Professional services, consulting firms. Clean setup, minimal compliance.',
    '{"staff":"Consultant","staff_plural":"Consultants","client":"Client","client_plural":"Clients","booking":"Session","booking_plural":"Sessions","operator":"Manager","service_tag":"Service"}'::jsonb,
    '{"show_age_gate_step":false,"age_gate_minimum":null,"staff_require_pseudonym":false,"deposits_supported":false,"show_price_to_client":false,"require_booking_notes":false,"booking_notes_label":"Notes","booking_notes_placeholder":"Anything we should know beforehand..."}'::jsonb,
    '{"show_kvk_field":false,"show_license_field":false,"show_bsn_on_staff":false,"show_gdpr_photo_consent":false,"require_terms_acceptance":false}'::jsonb,
    '{"client_mode":"guest","booking_confirm_mode":"auto_confirm","client_approval_mode":"auto","default_slot_minutes":30,"deposit_pct":0,"deposit_required_above_minutes":0}'::jsonb,
    '[{"name":"Strategy"},{"name":"Implementation"},{"name":"Audit"},{"name":"Workshop"}]'::jsonb,
    true, 3
  ),
  (
    'custom', 'Custom', '🔧',
    'Build your own configuration from scratch. Neutral defaults, no pre-set services.',
    '{"staff":"Staff","staff_plural":"Staff","client":"Client","client_plural":"Clients","booking":"Booking","booking_plural":"Bookings","operator":"Manager","service_tag":"Service"}'::jsonb,
    '{"show_age_gate_step":false,"age_gate_minimum":null,"staff_require_pseudonym":false,"deposits_supported":false,"show_price_to_client":false,"require_booking_notes":false,"booking_notes_label":"Notes","booking_notes_placeholder":"Any additional information..."}'::jsonb,
    '{"show_kvk_field":false,"show_license_field":false,"show_bsn_on_staff":false,"show_gdpr_photo_consent":false,"require_terms_acceptance":false}'::jsonb,
    '{"client_mode":"guest","booking_confirm_mode":"auto_confirm","client_approval_mode":"auto","default_slot_minutes":30,"deposit_pct":0,"deposit_required_above_minutes":0}'::jsonb,
    '[]'::jsonb,
    true, 4
  );

-- 3. Create tenant_config table
CREATE TABLE tenant_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_template_slug  TEXT,
  terminology           JSONB NOT NULL DEFAULT '{}'::jsonb,
  feature_flags         JSONB NOT NULL DEFAULT '{}'::jsonb,
  compliance_flags      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tenant_config ENABLE ROW LEVEL SECURITY;
-- NOTE: tenant_id claim is nested under app_metadata by custom_access_token_hook,
-- matching every other tenant_isolation policy in 20260601000001_initial_schema.sql.
CREATE POLICY tenant_isolation ON tenant_config
  FOR ALL USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

-- 4. Stamp existing tenants from their vertical
INSERT INTO tenant_config (tenant_id, source_template_slug, terminology, feature_flags, compliance_flags)
SELECT
  t.id,
  t.vertical,
  it.terminology,
  it.feature_flags,
  it.compliance_flags
FROM tenants t
JOIN industry_templates it ON it.slug = t.vertical
WHERE t.vertical IS NOT NULL;

-- 5. Drop hardcoded CHECK constraint on tenants.vertical
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_vertical_check;
