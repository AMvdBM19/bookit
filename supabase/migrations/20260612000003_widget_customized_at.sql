-- Phase 15-A3: explicit completion marker for the "Customize widget"
-- onboarding step. Set by the settings PATCH whenever a widget_* field is
-- saved; the checklist marks the step done iff this is non-null (replaces
-- the widget_font_pair heuristic).
ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS widget_customized_at TIMESTAMPTZ NULL;

-- Backfill: a tenant counts as customized when at least one widget field
-- deviates from its column default. (The old widget_font_pair heuristic
-- was always true — that column has DEFAULT 'default'.)
UPDATE tenant_settings SET widget_customized_at = COALESCE(updated_at, NOW())
WHERE widget_customized_at IS NULL AND (
      COALESCE(widget_primary_color,'#2BB673') <> '#2BB673'
   OR COALESCE(widget_accent_color,'#1D9E75') <> '#1D9E75'
   OR COALESCE(widget_bg,'white') <> 'white'
   OR widget_bg_custom IS NOT NULL
   OR COALESCE(widget_border_color,'#27272a') <> '#27272a'
   OR COALESCE(widget_border_radius,'md') <> 'md'
   OR COALESCE(widget_card_style,'bordered') <> 'bordered'
   OR COALESCE(widget_font_pair,'default') <> 'default'
   OR COALESCE(widget_layout,'grid') <> 'grid'
   OR widget_logo_url IS NOT NULL
   OR COALESCE(widget_show_powered_by,true) <> true
   OR COALESCE(widget_spacing,'normal') <> 'normal'
   OR COALESCE(widget_surface_color,'#18181b') <> '#18181b'
   OR COALESCE(widget_text_color,'#ffffff') <> '#ffffff'
   OR COALESCE(widget_text_muted,'#a1a1aa') <> '#a1a1aa'
);
