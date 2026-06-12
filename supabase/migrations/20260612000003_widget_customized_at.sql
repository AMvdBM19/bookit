-- Phase 15-A3: explicit completion marker for the "Customize widget"
-- onboarding step. Set by the settings PATCH whenever a widget_* field is
-- saved; the checklist marks the step done iff this is non-null (replaces
-- the widget_font_pair heuristic).
ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS widget_customized_at TIMESTAMPTZ NULL;

-- Backfill: tenants that already saved a widget theme (any save writes
-- widget_font_pair) count as customized.
UPDATE tenant_settings
  SET widget_customized_at = COALESCE(updated_at, NOW())
  WHERE widget_customized_at IS NULL AND widget_font_pair IS NOT NULL;
