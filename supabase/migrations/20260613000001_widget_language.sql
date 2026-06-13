-- Phase 16-C2: widget interface language (chrome translation only —
-- tenant terminology stays as authored). Default 'en' keeps every
-- existing widget unchanged.
ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS widget_language TEXT NOT NULL DEFAULT 'en'
  CHECK (widget_language IN ('en','nl'));
