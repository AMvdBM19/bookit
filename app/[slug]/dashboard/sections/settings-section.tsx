'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTenantConfig } from '@/lib/context/tenant-config';

interface Tenant {
  name: string;
  slug: string;
  vertical: string;
  client_mode: string;
}

interface Settings {
  agency_display_name: string | null;
  logo_url: string | null;
  brand_color: string | null;
  booking_confirm_mode: string;
  base_rate_per_30min: number;
  currency: string;
  min_lead_time_hours: number;
  max_booking_days_ahead: number;
  age_gate_minimum: number;
  require_age_confirm: boolean;
  show_price_to_client: boolean;
  reminder_lead_time_minutes: number;
  deposit_pct: number | null;
  deposit_required_above_minutes: number | null;
}

interface Summary {
  tenant: Tenant | null;
  settings: Settings | null;
  locked_fields: string[];
  integrations: {
    whatsapp: { configured: boolean; provider: string | null };
  };
}

const inputCls =
  'w-full text-sm border border-zinc-300 rounded px-3 py-1.5 focus:outline-none focus:border-zinc-500';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-zinc-200 last:border-0">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-900 text-right">{value || '—'}</span>
    </div>
  );
}

function EditRow({
  label,
  children,
  locked,
}: {
  label: string;
  children: React.ReactNode;
  locked?: boolean;
}) {
  return (
    <div className="py-2 border-b border-zinc-200 last:border-0">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-xs text-zinc-500">{label}</span>
        {locked && (
          <span className="text-[10px] uppercase tracking-wider text-zinc-400">Locked</span>
        )}
      </div>
      {children}
    </div>
  );
}

export default function SettingsSection({ slug }: { slug: string }) {
  const { terminology } = useTenantConfig();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Settings>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${slug}/settings/summary`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load settings');
        return;
      }
      setSummary(data);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    reload();
  }, [reload]);

  function startEdit(section: string) {
    if (!summary?.settings) return;
    setDraft(summary.settings);
    setSaveError(null);
    setEditingSection(section);
  }

  function cancelEdit() {
    setDraft({});
    setSaveError(null);
    setEditingSection(null);
  }

  function patchDraft(updates: Partial<Settings>) {
    setDraft(prev => ({ ...prev, ...updates }));
  }

  async function saveSection(fields: (keyof Settings)[]) {
    setSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, unknown> = {};
      for (const f of fields) {
        if (draft[f] !== undefined) body[f] = draft[f];
      }
      const res = await fetch(`/api/${slug}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? 'Failed to save');
        return;
      }
      setEditingSection(null);
      setDraft({});
      await reload();
    } catch {
      setSaveError('Network error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading settings…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!summary) return null;

  const { tenant, settings, integrations, locked_fields } = summary;
  const lockedSet = new Set(locked_fields);
  const wa = integrations.whatsapp;

  function isLocked(field: keyof Settings): boolean {
    return lockedSet.has(field);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <p className="text-xs text-zinc-500">
        Editable settings update immediately. Locked fields were set during onboarding and require support to change.
      </p>

      {/* Identity */}
      <section>
        <SectionHeader
          title="Identity"
          editing={editingSection === 'identity'}
          onEdit={() => startEdit('identity')}
          onCancel={cancelEdit}
          onSave={() => saveSection(['agency_display_name', 'logo_url', 'brand_color'])}
          saving={saving}
        />
        <div className="bg-white rounded-lg border border-zinc-200 px-4">
          {editingSection === 'identity' ? (
            <>
              <EditRow label="Display name">
                <input
                  type="text"
                  value={draft.agency_display_name ?? ''}
                  onChange={e => patchDraft({ agency_display_name: e.target.value })}
                  className={inputCls}
                />
              </EditRow>
              <EditRow label="Logo URL">
                <input
                  type="url"
                  value={draft.logo_url ?? ''}
                  onChange={e => patchDraft({ logo_url: e.target.value })}
                  className={inputCls}
                  placeholder="https://..."
                />
              </EditRow>
              <EditRow label="Brand color">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={draft.brand_color ?? '#2BB673'}
                    onChange={e => patchDraft({ brand_color: e.target.value })}
                    className="h-8 w-12 rounded border border-zinc-300 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={draft.brand_color ?? ''}
                    onChange={e => patchDraft({ brand_color: e.target.value })}
                    className={inputCls + ' font-mono'}
                    placeholder="#2BB673"
                    maxLength={7}
                  />
                </div>
              </EditRow>
            </>
          ) : (
            <>
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
              <Row
                label="Brand color"
                value={
                  settings?.brand_color ? (
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded-full border border-zinc-300"
                        style={{ backgroundColor: settings.brand_color }}
                      />
                      <code className="text-xs">{settings.brand_color}</code>
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
            </>
          )}
        </div>
      </section>

      {/* Bookings */}
      <section>
        <SectionHeader
          title="Bookings"
          editing={editingSection === 'bookings'}
          onEdit={() => startEdit('bookings')}
          onCancel={cancelEdit}
          onSave={() =>
            saveSection([
              'booking_confirm_mode',
              'min_lead_time_hours',
              'max_booking_days_ahead',
              'reminder_lead_time_minutes',
            ])
          }
          saving={saving}
        />
        <div className="bg-white rounded-lg border border-zinc-200 px-4">
          {editingSection === 'bookings' ? (
            <>
              <EditRow label="Confirm mode">
                <select
                  value={draft.booking_confirm_mode ?? 'staff_must_accept'}
                  onChange={e => patchDraft({ booking_confirm_mode: e.target.value })}
                  className={inputCls}
                >
                  <option value="staff_must_accept">{terminology.staff} must accept</option>
                  <option value="auto_confirm">Auto-confirm</option>
                </select>
              </EditRow>
              <EditRow label="Min lead time (h)">
                <input
                  type="number"
                  min={0}
                  value={draft.min_lead_time_hours ?? 0}
                  onChange={e => patchDraft({ min_lead_time_hours: Number(e.target.value) })}
                  className={inputCls}
                />
              </EditRow>
              <EditRow label="Max booking window (days)">
                <input
                  type="number"
                  min={1}
                  value={draft.max_booking_days_ahead ?? 30}
                  onChange={e => patchDraft({ max_booking_days_ahead: Number(e.target.value) })}
                  className={inputCls}
                />
              </EditRow>
              <EditRow label="Reminder lead time (min)">
                <input
                  type="number"
                  min={0}
                  value={draft.reminder_lead_time_minutes ?? 60}
                  onChange={e => patchDraft({ reminder_lead_time_minutes: Number(e.target.value) })}
                  className={inputCls}
                />
              </EditRow>
            </>
          ) : (
            <>
              <Row
                label="Confirm mode"
                value={
                  settings?.booking_confirm_mode === 'auto_confirm'
                    ? 'Auto-confirm'
                    : `${terminology.staff} must accept`
                }
              />
              <Row label="Min lead time" value={`${settings?.min_lead_time_hours ?? '—'} h`} />
              <Row
                label="Max booking window"
                value={`${settings?.max_booking_days_ahead ?? '—'} days`}
              />
              <Row
                label="Reminder lead time"
                value={`${settings?.reminder_lead_time_minutes ?? '—'} min`}
              />
              <Row label="Client mode" value={tenant?.client_mode} />
            </>
          )}
        </div>
      </section>

      {/* Compliance */}
      <section>
        <SectionHeader
          title="Compliance"
          editing={editingSection === 'compliance'}
          onEdit={() => startEdit('compliance')}
          onCancel={cancelEdit}
          onSave={() => saveSection(['require_age_confirm'])}
          saving={saving}
        />
        <div className="bg-white rounded-lg border border-zinc-200 px-4">
          {editingSection === 'compliance' ? (
            <>
              <EditRow label="Minimum age" locked={isLocked('age_gate_minimum')}>
                <p className="text-sm text-zinc-500">{settings?.age_gate_minimum}</p>
              </EditRow>
              <EditRow label="Age confirmation">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.require_age_confirm ?? false}
                    onChange={e => patchDraft({ require_age_confirm: e.target.checked })}
                  />
                  <span className="text-sm text-zinc-700">Require clients to confirm age</span>
                </label>
              </EditRow>
            </>
          ) : (
            <>
              <Row label="Minimum age" value={settings?.age_gate_minimum} />
              <Row
                label="Age confirmation"
                value={settings?.require_age_confirm ? 'Required' : 'Not required'}
              />
            </>
          )}
        </div>
      </section>

      {/* Integrations (read-only) */}
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

      {saveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {saveError}
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  editing,
  onEdit,
  onCancel,
  onSave,
  saving,
}: {
  title: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{title}</h3>
      {editing ? (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="text-xs px-2 py-1 text-zinc-600 hover:bg-zinc-100 rounded"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="text-xs px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onEdit}
          className="text-xs px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded"
        >
          Edit
        </button>
      )}
    </div>
  );
}
