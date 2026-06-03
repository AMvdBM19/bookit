'use client';

import { useEffect, useState } from 'react';

interface Tenant {
  name: string;
  slug: string;
  vertical: string;
  client_mode: string;
}

interface Settings {
  agency_display_name: string | null;
  logo_url: string | null;
  booking_confirm_mode: string;
  base_rate_per_30min: number;
  currency: string;
  min_lead_time_hours: number;
  max_booking_days_ahead: number;
  age_gate_minimum: number;
  require_age_confirm: boolean;
}

interface Summary {
  tenant: Tenant | null;
  settings: Settings | null;
  integrations: {
    whatsapp: { configured: boolean; provider: string | null };
  };
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-zinc-200 last:border-0">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-900 text-right">{value || '—'}</span>
    </div>
  );
}

export default function SettingsSection({ slug }: { slug: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/${slug}/settings/summary`)
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) {
          setError(data.error ?? 'Failed to load settings');
          return;
        }
        setSummary(data);
      })
      .catch(() => {
        if (!cancelled) setError('Network error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) return <p className="text-sm text-zinc-500">Loading settings…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!summary) return null;

  const { tenant, settings, integrations } = summary;
  const wa = integrations.whatsapp;

  return (
    <div className="space-y-6 max-w-2xl">
      <p className="text-xs text-zinc-500">
        Read-only summary. Editing comes in a later phase.
      </p>

      <section>
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
          Identity
        </h3>
        <div className="bg-white rounded-lg border border-zinc-200 px-4">
          <Row label="Display name" value={settings?.agency_display_name ?? tenant?.name} />
          <Row label="Slug" value={tenant?.slug} />
          <Row label="Vertical" value={tenant?.vertical} />
          <Row
            label="Logo"
            value={
              settings?.logo_url ? (
                <a
                  href={settings.logo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-xs break-all"
                >
                  {settings.logo_url}
                </a>
              ) : (
                'Not set'
              )
            }
          />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
          Bookings
        </h3>
        <div className="bg-white rounded-lg border border-zinc-200 px-4">
          <Row
            label="Confirm mode"
            value={
              settings?.booking_confirm_mode === 'auto_confirm'
                ? 'Auto-confirm'
                : 'Staff must accept'
            }
          />
          <Row
            label="Base rate / 30 min"
            value={`${settings?.currency ?? 'EUR'} ${settings?.base_rate_per_30min?.toFixed(2) ?? '—'}`}
          />
          <Row label="Min lead time" value={`${settings?.min_lead_time_hours ?? '—'} h`} />
          <Row
            label="Max booking window"
            value={`${settings?.max_booking_days_ahead ?? '—'} days`}
          />
          <Row label="Client mode" value={tenant?.client_mode} />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
          Compliance
        </h3>
        <div className="bg-white rounded-lg border border-zinc-200 px-4">
          <Row label="Minimum age" value={settings?.age_gate_minimum} />
          <Row
            label="Age confirmation"
            value={settings?.require_age_confirm ? 'Required' : 'Not required'}
          />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
          Integrations
        </h3>
        <div className="bg-white rounded-lg border border-zinc-200 px-4">
          <Row
            label="WhatsApp"
            value={
              wa.configured ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded border bg-emerald-100 text-emerald-800 border-emerald-200">
                    Configured
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    ({wa.provider === 'meta_whatsapp' ? 'Meta' : 'Twilio'})
                  </span>
                </span>
              ) : (
                <span className="inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded border bg-zinc-100 text-zinc-700 border-zinc-200">
                  Not configured
                </span>
              )
            }
          />
        </div>
      </section>
    </div>
  );
}
