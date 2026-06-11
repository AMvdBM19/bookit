'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  PRESETS,
  DEFAULT_WIDGET_THEME,
  themeToVars,
  themeToSettings,
  settingsToTheme,
} from '@/lib/widget-theme';
import type { WidgetTheme, WidgetSettingsRow } from '@/lib/widget-theme';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.bookit.monoliet.cloud';

const sectionCls = 'rounded-lg border border-border bg-surface p-4';
const sectionTitleCls = 'text-xs font-medium uppercase tracking-wider text-fg-muted mb-3';
const inputCls =
  'w-full text-sm bg-elevated text-fg border border-border rounded px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-fg-muted w-24 shrink-0">{label}</span>
      <input
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'}
        onChange={e => onChange(e.target.value)}
        className="h-7 w-9 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
        aria-label={`${label} color picker`}
      />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 min-w-0 text-xs font-mono bg-elevated text-fg border border-border rounded px-2 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="#000000"
      />
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-elevated p-0.5 gap-0.5">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`px-2.5 py-1 text-xs rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            value === opt.value
              ? 'bg-fg text-canvas'
              : 'text-fg-muted hover:text-fg'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

type EmbedTab = 'wordpress' | 'html' | 'script';

export default function WidgetSection({ slug }: { slug: string }) {
  const [theme, setTheme] = useState<WidgetTheme>({ ...DEFAULT_WIDGET_THEME });
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [embedTab, setEmbedTab] = useState<EmbedTab>('wordpress');
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load current saved theme.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/${slug}/settings/summary`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? 'Failed to load settings');
          return;
        }
        const row = (data.settings ?? null) as WidgetSettingsRow | null;
        setTheme(settingsToTheme(row));
        setLogoUrl((data.settings?.widget_logo_url as string | null) ?? '');
      } catch {
        if (!cancelled) setError('Network error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Push the current theme into the preview iframe.
  const pushTheme = useCallback(
    (t: WidgetTheme) => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'bookit:theme-override', vars: themeToVars(t) },
        '*'
      );
    },
    []
  );

  useEffect(() => {
    pushTheme(theme);
  }, [theme, pushTheme]);

  function update(patch: Partial<WidgetTheme>) {
    setSaveMsg(null);
    setTheme(prev => ({ ...prev, ...patch }));
  }

  function applyPreset(key: string) {
    const preset = PRESETS[key];
    if (preset) {
      setSaveMsg(null);
      setTheme({ ...preset.theme });
    }
  }

  const activePresetKey = Object.keys(PRESETS).find(
    k => JSON.stringify(PRESETS[k].theme) === JSON.stringify(theme)
  );

  function setBgMode(mode: WidgetTheme['bg_mode']) {
    if (mode === 'dark') update({ bg_mode: 'dark', bg_color: '#09090b' });
    else if (mode === 'light') update({ bg_mode: 'light', bg_color: '#ffffff' });
    else update({ bg_mode: 'custom' });
  }

  async function save() {
    setSaving(true);
    setSaveMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/${slug}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...themeToSettings(theme),
          widget_logo_url: logoUrl.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to save');
        toast.error(data.error ?? "Couldn't save theme. Please try again.");
        return;
      }
      setSaveMsg('Saved — your widget is live with this theme.');
      toast.success('Widget theme saved.');
    } catch {
      setError('Network error');
      toast.error("Couldn't save theme. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const widgetUrl = `${APP_URL}/book/${slug}`;
  const EMBED_SNIPPETS: Record<EmbedTab, string> = {
    wordpress: `[bookit slug="${slug}"]`,
    html: `<iframe src="${widgetUrl}"\n  width="100%" height="700" frameborder="0"\n  style="border:none;max-width:100%"\n  title="Book an appointment"></iframe>`,
    script: `<div data-bookit-slug="${slug}"></div>\n<script src="${APP_URL}/embed.js" defer></script>`,
  };

  async function copyEmbed() {
    try {
      await navigator.clipboard.writeText(EMBED_SNIPPETS[embedTab]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Could not copy to clipboard');
    }
  }

  if (loading) {
    return <p className="text-sm text-fg-muted">Loading widget settings…</p>;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* ── Controls ─────────────────────────────────── */}
      <div className="w-full lg:w-[360px] shrink-0 space-y-4 order-last lg:order-first">
        {/* Presets */}
        <section className={sectionCls}>
          <h3 className={sectionTitleCls}>Presets</h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(PRESETS).map(([key, preset]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  activePresetKey === key
                    ? 'border-fg bg-elevated'
                    : 'border-border hover:border-border-strong'
                }`}
              >
                <span
                  className="w-5 h-5 rounded-full border border-border shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${preset.theme.bg_color} 50%, ${preset.theme.primary_color} 50%)`,
                  }}
                  aria-hidden
                />
                <span className="text-xs text-fg truncate">
                  {preset.icon} {preset.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Colors */}
        <section className={sectionCls}>
          <h3 className={sectionTitleCls}>Colors</h3>
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-fg-muted w-24 shrink-0">Background</span>
              <Segmented
                options={[
                  { value: 'dark', label: 'Dark' },
                  { value: 'light', label: 'Light' },
                  { value: 'custom', label: 'Custom' },
                ]}
                value={theme.bg_mode}
                onChange={setBgMode}
              />
            </div>
            {theme.bg_mode === 'custom' && (
              <ColorRow
                label="Custom bg"
                value={theme.bg_color}
                onChange={v => update({ bg_color: v })}
              />
            )}
            <ColorRow label="Primary" value={theme.primary_color} onChange={v => update({ primary_color: v })} />
            <ColorRow label="Accent" value={theme.accent_color} onChange={v => update({ accent_color: v })} />
            <ColorRow label="Surface" value={theme.surface_color} onChange={v => update({ surface_color: v })} />
            <ColorRow label="Text" value={theme.text_color} onChange={v => update({ text_color: v })} />
            <ColorRow label="Text muted" value={theme.text_muted} onChange={v => update({ text_muted: v })} />
            <ColorRow label="Border" value={theme.border_color} onChange={v => update({ border_color: v })} />
          </div>
        </section>

        {/* Shape */}
        <section className={sectionCls}>
          <h3 className={sectionTitleCls}>Shape</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-fg-muted mb-1.5">Corners</p>
              <Segmented
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'sm', label: 'SM' },
                  { value: 'md', label: 'MD' },
                  { value: 'lg', label: 'LG' },
                  { value: 'full', label: 'XL' },
                ]}
                value={theme.border_radius}
                onChange={v => update({ border_radius: v })}
              />
            </div>
            <div>
              <p className="text-xs text-fg-muted mb-1.5">Cards</p>
              <Segmented
                options={[
                  { value: 'bordered', label: 'Bordered' },
                  { value: 'elevated', label: 'Elevated' },
                  { value: 'flat', label: 'Flat' },
                ]}
                value={theme.card_style}
                onChange={v => update({ card_style: v })}
              />
            </div>
            <div>
              <p className="text-xs text-fg-muted mb-1.5">Spacing</p>
              <Segmented
                options={[
                  { value: 'compact', label: 'Compact' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'relaxed', label: 'Relaxed' },
                ]}
                value={theme.spacing}
                onChange={v => update({ spacing: v })}
              />
            </div>
          </div>
        </section>

        {/* Branding */}
        <section className={sectionCls}>
          <h3 className={sectionTitleCls}>Branding</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={theme.show_powered_by}
                onChange={e => update({ show_powered_by: e.target.checked })}
                className="accent-fg"
              />
              <span className="text-xs text-fg">Show &ldquo;Powered by Book-IT&rdquo;</span>
            </label>
            <div>
              <label className="block text-xs text-fg-muted mb-1" htmlFor="widget-logo-url">
                Widget logo URL
              </label>
              <input
                id="widget-logo-url"
                type="url"
                value={logoUrl}
                onChange={e => {
                  setLogoUrl(e.target.value);
                  setSaveMsg(null);
                }}
                className={inputCls}
                placeholder="https://… (falls back to your main logo)"
              />
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="text-sm px-4 py-2 bg-fg text-canvas rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save & Apply'}
          </button>
          <button
            type="button"
            onClick={() => {
              setSaveMsg(null);
              setTheme({ ...DEFAULT_WIDGET_THEME });
            }}
            disabled={saving}
            className="text-sm px-3 py-2 text-fg-muted hover:text-fg hover:bg-elevated rounded-lg transition-colors"
          >
            Reset to Default
          </button>
        </div>
        {saveMsg && <p className="text-xs text-emerald-600 dark:text-emerald-400">{saveMsg}</p>}
        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* Embed code */}
        <section className={sectionCls}>
          <h3 className={sectionTitleCls}>Embed Code</h3>
          <div className="flex gap-1 mb-2">
            {(
              [
                ['wordpress', 'WordPress'],
                ['html', 'HTML'],
                ['script', 'Script'],
              ] as Array<[EmbedTab, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setEmbedTab(key)}
                aria-pressed={embedTab === key}
                className={`text-xs px-2.5 py-1 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  embedTab === key
                    ? 'bg-fg text-canvas'
                    : 'text-fg-muted hover:text-fg hover:bg-elevated'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <pre className="text-[11px] font-mono bg-elevated border border-border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all text-fg">
            {EMBED_SNIPPETS[embedTab]}
          </pre>
          <button
            type="button"
            onClick={copyEmbed}
            className="mt-2 text-xs px-3 py-1.5 bg-elevated hover:bg-sunken text-fg rounded transition-colors"
          >
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
          {embedTab === 'wordpress' && (
            <p className="text-[11px] text-fg-muted mt-2">
              Requires the Book-IT WordPress plugin. Optional: <code className="font-mono">height=&quot;800&quot;</code>.
            </p>
          )}
        </section>
      </div>

      {/* ── Live preview ─────────────────────────────── */}
      <div className="flex-1 min-w-0 w-full order-first lg:order-last lg:sticky lg:top-20">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-fg-muted">
            Live preview — changes apply instantly, save to publish.
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setDevice('mobile')}
              aria-pressed={device === 'mobile'}
              className={`text-xs px-2.5 py-1 rounded transition-colors ${
                device === 'mobile' ? 'bg-fg text-canvas' : 'text-fg-muted hover:text-fg hover:bg-elevated'
              }`}
            >
              📱 Mobile
            </button>
            <button
              type="button"
              onClick={() => setDevice('desktop')}
              aria-pressed={device === 'desktop'}
              className={`text-xs px-2.5 py-1 rounded transition-colors ${
                device === 'desktop' ? 'bg-fg text-canvas' : 'text-fg-muted hover:text-fg hover:bg-elevated'
              }`}
            >
              🖥 Desktop
            </button>
          </div>
        </div>
        <div
          className={`mx-auto transition-all rounded-xl border border-border shadow-lg overflow-hidden bg-canvas ${
            device === 'mobile' ? 'max-w-[380px]' : 'w-full'
          }`}
        >
          <iframe
            ref={iframeRef}
            src={`/book/${slug}?preview=1`}
            onLoad={() => pushTheme(theme)}
            title="Widget preview"
            className="w-full h-[640px] border-0"
          />
        </div>
      </div>
    </div>
  );
}
