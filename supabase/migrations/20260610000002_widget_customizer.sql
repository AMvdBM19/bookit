-- Phase 12A: Widget customizer — expand widget settings
ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS widget_border_radius TEXT DEFAULT 'md'
    CHECK (widget_border_radius IN ('none', 'sm', 'md', 'lg', 'full')),
  ADD COLUMN IF NOT EXISTS widget_card_style TEXT DEFAULT 'bordered'
    CHECK (widget_card_style IN ('bordered', 'elevated', 'flat')),
  ADD COLUMN IF NOT EXISTS widget_spacing TEXT DEFAULT 'normal'
    CHECK (widget_spacing IN ('compact', 'normal', 'relaxed')),
  ADD COLUMN IF NOT EXISTS widget_text_color TEXT DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS widget_text_muted TEXT DEFAULT '#a1a1aa',
  ADD COLUMN IF NOT EXISTS widget_surface_color TEXT DEFAULT '#18181b',
  ADD COLUMN IF NOT EXISTS widget_border_color TEXT DEFAULT '#27272a',
  ADD COLUMN IF NOT EXISTS widget_show_powered_by BOOLEAN DEFAULT TRUE;

-- Expand widget_bg to support custom hex via a separate column.
ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS widget_bg_custom TEXT;
COMMENT ON COLUMN tenant_settings.widget_bg_custom IS 'Custom hex background color; only used when widget_bg = custom';

-- Allow 'custom' in widget_bg.
ALTER TABLE tenant_settings DROP CONSTRAINT IF EXISTS tenant_settings_widget_bg_check;
ALTER TABLE tenant_settings ADD CONSTRAINT tenant_settings_widget_bg_check
  CHECK (widget_bg IN ('white', 'off-white', 'light-gray', 'dark', 'custom'));
