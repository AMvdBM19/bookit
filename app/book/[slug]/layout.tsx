import { createServiceClient } from '@/lib/supabase/server';
import { settingsToTheme, themeToCSS } from '@/lib/widget-theme';
import type { WidgetSettingsRow } from '@/lib/widget-theme';

// Scoped utility classes for the widget. Derived shades are color-mixed from
// the theme variables so a single palette drives the whole widget. With the
// default (midnight) theme these resolve to the historical zinc values.
const WIDGET_BASE_CSS = `
.bookit-widget {
  --w-elevated: color-mix(in srgb, var(--w-surface), var(--w-text) 6%);
  --w-elevated-hover: color-mix(in srgb, var(--w-surface), var(--w-text) 13%);
  --w-border-strong: color-mix(in srgb, var(--w-border), var(--w-text) 12%);
  --w-border-hover: color-mix(in srgb, var(--w-border), var(--w-text) 28%);
  --w-text-soft: color-mix(in srgb, var(--w-text) 60%, var(--w-text-muted));
  --w-text-subtle: color-mix(in srgb, var(--w-text-muted) 70%, var(--w-bg));
  --w-ring: color-mix(in srgb, var(--w-text) 40%, transparent);
  background-color: var(--w-bg);
  color: var(--w-text);
  font-family: var(--w-font);
}
.bookit-widget .w-bg { background-color: var(--w-bg); }
.bookit-widget .w-sf { background-color: var(--w-surface); }
.bookit-widget .w-el { background-color: var(--w-elevated); }
.bookit-widget .w-bd { border-color: var(--w-border); }
.bookit-widget .w-bd2 { border-color: var(--w-border-strong); }
.bookit-widget .w-hbd:hover { border-color: var(--w-border-hover); }
.bookit-widget .w-tx { color: var(--w-text); }
.bookit-widget .w-tx-soft { color: var(--w-text-soft); }
.bookit-widget .w-tx2 { color: var(--w-text-muted); }
.bookit-widget .w-tx3 { color: var(--w-text-subtle); }
.bookit-widget .w-ph::placeholder { color: var(--w-text-subtle); }
.bookit-widget .w-round { border-radius: var(--w-radius); }
.bookit-widget .w-card {
  background-color: var(--w-surface);
  border: var(--w-card-border);
  box-shadow: var(--w-card-shadow);
  border-radius: var(--w-radius);
}
.bookit-widget .w-input {
  background-color: var(--w-elevated);
  border: 1px solid var(--w-border-strong);
  border-radius: var(--w-radius);
  color: var(--w-text);
}
.bookit-widget .w-input:focus { outline: none; border-color: var(--w-border-hover); }
.bookit-widget .w-input::placeholder { color: var(--w-text-subtle); }
.bookit-widget .w-btn {
  background-color: var(--w-text);
  color: var(--w-bg);
}
.bookit-widget .w-btn:hover { opacity: 0.9; }
.bookit-widget .w-btn2 { background-color: var(--w-elevated); color: var(--w-text); }
.bookit-widget .w-btn2:hover { background-color: var(--w-elevated-hover); }
.bookit-widget .w-pad { padding: calc(1rem * var(--w-space)); }
.bookit-widget .w-pad-sm { padding: calc(0.75rem * var(--w-space)); }
.bookit-widget .w-pad-lg { padding: calc(1.5rem * var(--w-space)); }
.bookit-widget .w-focus:focus-visible {
  outline: 2px solid var(--w-ring);
  outline-offset: 2px;
}
.bookit-widget input[type="checkbox"] { accent-color: var(--w-text); }
`;

// Live preview bridge: the dashboard customizer embeds this page in an iframe
// and pushes CSS variable overrides on every control change.
const THEME_LISTENER_JS = `
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'bookit:theme-override') {
    var root = document.querySelector('.bookit-widget');
    if (!root) return;
    var vars = e.data.vars || {};
    for (var k in vars) {
      if (Object.prototype.hasOwnProperty.call(vars, k) && k.indexOf('--w-') === 0) {
        root.style.setProperty(k, String(vars[k]));
      }
    }
  }
});
`;

export default async function BookingWidgetLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const supabase = createServiceClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  let settingsRow: WidgetSettingsRow | null = null;
  if (tenant) {
    const { data } = await supabase
      .from('tenant_settings')
      .select(
        'brand_color, widget_primary_color, widget_accent_color, widget_bg, widget_bg_custom, widget_font_pair, widget_border_radius, widget_card_style, widget_spacing, widget_text_color, widget_text_muted, widget_surface_color, widget_border_color, widget_show_powered_by'
      )
      .eq('tenant_id', tenant.id)
      .maybeSingle();
    settingsRow = data as WidgetSettingsRow | null;
  }

  const theme = settingsToTheme(settingsRow);
  const themeCSS = themeToCSS(theme);

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `.bookit-widget {\n  ${themeCSS}\n}\n${WIDGET_BASE_CSS}`,
        }}
      />
      <script dangerouslySetInnerHTML={{ __html: THEME_LISTENER_JS }} />
      <div className="bookit-widget font-sans antialiased min-h-screen">
        {children}
      </div>
    </>
  );
}
