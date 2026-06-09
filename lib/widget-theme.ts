// Widget theming system — Phase 12A.
// Single source of truth for the booking widget's customizable appearance.
// The widget renders from CSS custom properties (--w-*) so the customizer can
// live-preview changes via postMessage without a reload.

export interface WidgetTheme {
  // Background
  bg_mode: 'dark' | 'light' | 'custom'; // maps to widget_bg: 'dark' | 'white' | 'custom'
  bg_color: string; // actual bg hex (dark=#09090b, light=#ffffff, custom=user-set)
  surface_color: string; // card/input backgrounds
  border_color: string; // borders

  // Text
  text_color: string; // primary text
  text_muted: string; // secondary text

  // Brand
  primary_color: string; // CTA buttons, selections, progress bar
  accent_color: string; // secondary highlights

  // Typography
  font_pair: string; // 'system' | 'inter' | google font name (placeholder for future phase)

  // Shape
  border_radius: 'none' | 'sm' | 'md' | 'lg' | 'full';
  card_style: 'bordered' | 'elevated' | 'flat';
  spacing: 'compact' | 'normal' | 'relaxed';

  // Meta
  show_powered_by: boolean;
}

export const PRESETS: Record<string, { label: string; icon: string; theme: WidgetTheme }> = {
  midnight: {
    label: 'Midnight',
    icon: '🌙',
    theme: { bg_mode: 'dark', bg_color: '#09090b', surface_color: '#18181b', border_color: '#27272a', text_color: '#ffffff', text_muted: '#a1a1aa', primary_color: '#2BB673', accent_color: '#1D9E75', font_pair: 'system', border_radius: 'lg', card_style: 'bordered', spacing: 'normal', show_powered_by: true },
  },
  clean_light: {
    label: 'Clean Light',
    icon: '☀️',
    theme: { bg_mode: 'light', bg_color: '#ffffff', surface_color: '#f4f4f5', border_color: '#e4e4e7', text_color: '#18181b', text_muted: '#71717a', primary_color: '#2BB673', accent_color: '#16a34a', font_pair: 'system', border_radius: 'lg', card_style: 'bordered', spacing: 'normal', show_powered_by: true },
  },
  warm_cream: {
    label: 'Warm Cream',
    icon: '🍦',
    theme: { bg_mode: 'custom', bg_color: '#fef9f3', surface_color: '#fdf2e6', border_color: '#e8ddd0', text_color: '#3d2f22', text_muted: '#8b7355', primary_color: '#c47a3a', accent_color: '#a0522d', font_pair: 'system', border_radius: 'lg', card_style: 'elevated', spacing: 'normal', show_powered_by: true },
  },
  neon_dark: {
    label: 'Neon',
    icon: '💜',
    theme: { bg_mode: 'dark', bg_color: '#0a0a0f', surface_color: '#12121a', border_color: '#1e1e2e', text_color: '#e4e4ff', text_muted: '#8888bb', primary_color: '#a855f7', accent_color: '#7c3aed', font_pair: 'system', border_radius: 'md', card_style: 'bordered', spacing: 'normal', show_powered_by: true },
  },
  ocean: {
    label: 'Ocean',
    icon: '🌊',
    theme: { bg_mode: 'dark', bg_color: '#0c1222', surface_color: '#131b30', border_color: '#1e2d4a', text_color: '#e0eaff', text_muted: '#7b93b8', primary_color: '#3b82f6', accent_color: '#2563eb', font_pair: 'system', border_radius: 'lg', card_style: 'bordered', spacing: 'normal', show_powered_by: true },
  },
  minimal: {
    label: 'Minimal',
    icon: '⬜',
    theme: { bg_mode: 'light', bg_color: '#ffffff', surface_color: '#ffffff', border_color: '#e5e5e5', text_color: '#171717', text_muted: '#737373', primary_color: '#171717', accent_color: '#404040', font_pair: 'system', border_radius: 'sm', card_style: 'flat', spacing: 'compact', show_powered_by: false },
  },
  rose: {
    label: 'Rose',
    icon: '🌹',
    theme: { bg_mode: 'light', bg_color: '#fff5f5', surface_color: '#fff0f0', border_color: '#fecaca', text_color: '#4a1a1a', text_muted: '#9e5555', primary_color: '#e11d48', accent_color: '#be123c', font_pair: 'system', border_radius: 'lg', card_style: 'bordered', spacing: 'normal', show_powered_by: true },
  },
  forest: {
    label: 'Forest',
    icon: '🌿',
    theme: { bg_mode: 'dark', bg_color: '#0a1a0f', surface_color: '#112218', border_color: '#1a3324', text_color: '#d4edda', text_muted: '#7fb88d', primary_color: '#22c55e', accent_color: '#16a34a', font_pair: 'system', border_radius: 'md', card_style: 'bordered', spacing: 'normal', show_powered_by: true },
  },
};

// The widget's historical hardcoded look — must stay pixel-identical for
// tenants who never touched the customizer.
export const DEFAULT_WIDGET_THEME: WidgetTheme = PRESETS.midnight.theme;

const RADIUS_MAP: Record<WidgetTheme['border_radius'], string> = {
  none: '0px',
  sm: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem', // current widget look (rounded-lg)
  full: '1rem',
};

const SPACING_MAP: Record<WidgetTheme['spacing'], string> = {
  compact: '0.8',
  normal: '1', // current widget look
  relaxed: '1.2',
};

function fontStack(fontPair: string): string {
  // font_pair is a placeholder for a future Google Fonts phase — everything
  // resolves to the system stack for now.
  void fontPair;
  return "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
}

/** Theme → CSS custom property map (used for SSR style + live postMessage). */
export function themeToVars(theme: WidgetTheme): Record<string, string> {
  return {
    '--w-bg': theme.bg_color,
    '--w-surface': theme.surface_color,
    '--w-border': theme.border_color,
    '--w-text': theme.text_color,
    '--w-text-muted': theme.text_muted,
    '--w-primary': theme.primary_color,
    '--w-accent': theme.accent_color,
    '--w-radius': RADIUS_MAP[theme.border_radius] ?? RADIUS_MAP.lg,
    '--w-space': SPACING_MAP[theme.spacing] ?? '1',
    '--w-card-border':
      theme.card_style === 'bordered' ? '1px solid var(--w-border)' : '1px solid transparent',
    '--w-card-shadow':
      theme.card_style === 'elevated' ? '0 2px 12px rgba(0,0,0,0.12)' : 'none',
    '--w-font': fontStack(theme.font_pair),
  };
}

/** Theme → CSS declarations string (semicolon-joined, for a <style> block). */
export function themeToCSS(theme: WidgetTheme): string {
  return Object.entries(themeToVars(theme))
    .map(([k, v]) => `${k}: ${v};`)
    .join('\n  ');
}

// Shape of the widget_* columns on tenant_settings (all nullable when read
// defensively — older rows may predate the customizer migration).
export interface WidgetSettingsRow {
  brand_color?: string | null;
  widget_primary_color?: string | null;
  widget_accent_color?: string | null;
  widget_bg?: string | null;
  widget_bg_custom?: string | null;
  widget_font_pair?: string | null;
  widget_border_radius?: string | null;
  widget_card_style?: string | null;
  widget_spacing?: string | null;
  widget_text_color?: string | null;
  widget_text_muted?: string | null;
  widget_surface_color?: string | null;
  widget_border_color?: string | null;
  widget_show_powered_by?: boolean | null;
}

const BG_PRESETS: Record<string, { mode: WidgetTheme['bg_mode']; color: string }> = {
  dark: { mode: 'dark', color: '#09090b' },
  white: { mode: 'light', color: '#ffffff' },
  'off-white': { mode: 'light', color: '#fafaf9' },
  'light-gray': { mode: 'light', color: '#f4f4f5' },
};

/** tenant_settings row → WidgetTheme, with the historical dark defaults. */
export function settingsToTheme(s: WidgetSettingsRow | null | undefined): WidgetTheme {
  const d = DEFAULT_WIDGET_THEME;
  if (!s) return { ...d };

  // widget_bg default 'white' predates the widget actually being themeable —
  // the live widget has always rendered dark. Treat white/off-white/light-gray
  // as "light intent" only when the tenant explicitly saved other widget
  // colors; otherwise keep the historical dark look.
  const customized = !!(s.widget_text_color && s.widget_text_color !== '#ffffff')
    || !!(s.widget_surface_color && s.widget_surface_color !== '#18181b')
    || s.widget_bg === 'dark'
    || s.widget_bg === 'custom';

  let bg_mode: WidgetTheme['bg_mode'] = 'dark';
  let bg_color = d.bg_color;
  if (customized) {
    if (s.widget_bg === 'custom' && s.widget_bg_custom) {
      bg_mode = 'custom';
      bg_color = s.widget_bg_custom;
    } else {
      const preset = BG_PRESETS[s.widget_bg ?? 'dark'] ?? BG_PRESETS.dark;
      bg_mode = preset.mode;
      bg_color = preset.color;
    }
  }

  // Legacy fallback: tenants set brand_color long before widget_primary_color
  // existed (its column default is #2BB673 regardless). When the widget primary
  // is still the untouched default, the brand color keeps winning so existing
  // widgets don't change color.
  const primary =
    s.widget_primary_color && s.widget_primary_color !== '#2BB673'
      ? s.widget_primary_color
      : s.brand_color || d.primary_color;

  return {
    bg_mode,
    bg_color,
    surface_color: s.widget_surface_color || d.surface_color,
    border_color: s.widget_border_color || d.border_color,
    text_color: s.widget_text_color || d.text_color,
    text_muted: s.widget_text_muted || d.text_muted,
    primary_color: primary,
    accent_color: s.widget_accent_color || d.accent_color,
    font_pair: s.widget_font_pair || 'system',
    border_radius: (['none', 'sm', 'md', 'lg', 'full'].includes(s.widget_border_radius ?? '')
      ? s.widget_border_radius
      : d.border_radius) as WidgetTheme['border_radius'],
    card_style: (['bordered', 'elevated', 'flat'].includes(s.widget_card_style ?? '')
      ? s.widget_card_style
      : d.card_style) as WidgetTheme['card_style'],
    spacing: (['compact', 'normal', 'relaxed'].includes(s.widget_spacing ?? '')
      ? s.widget_spacing
      : d.spacing) as WidgetTheme['spacing'],
    show_powered_by: s.widget_show_powered_by ?? d.show_powered_by,
  };
}

/** WidgetTheme → tenant_settings PATCH payload. */
export function themeToSettings(theme: WidgetTheme): Record<string, unknown> {
  return {
    widget_primary_color: theme.primary_color,
    widget_accent_color: theme.accent_color,
    widget_bg: theme.bg_mode === 'dark' ? 'dark' : theme.bg_mode === 'light' ? 'white' : 'custom',
    widget_bg_custom: theme.bg_mode === 'custom' ? theme.bg_color : null,
    widget_font_pair: theme.font_pair,
    widget_border_radius: theme.border_radius,
    widget_card_style: theme.card_style,
    widget_spacing: theme.spacing,
    widget_text_color: theme.text_color,
    widget_text_muted: theme.text_muted,
    widget_surface_color: theme.surface_color,
    widget_border_color: theme.border_color,
    widget_show_powered_by: theme.show_powered_by,
  };
}
