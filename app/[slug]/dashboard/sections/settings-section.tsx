'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTenantConfig } from '@/lib/context/tenant-config';
import Spinner from '@/components/ui/spinner';
import Badge from '@/components/ui/badge';
import Modal from '@/components/ui/modal';
import { ONBOARDING_REOPEN_EVENT } from '@/components/onboarding-checklist';

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
  buffer_before_minutes?: number;
  buffer_after_minutes?: number;
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
  'w-full text-sm bg-elevated text-fg border border-border rounded px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-border-strong';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-border last:border-0">
      <span className="text-xs text-fg-muted">{label}</span>
      <span className="text-sm text-fg text-right">{value || '—'}</span>
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
    <div className="py-2 border-b border-border last:border-0">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-xs text-fg-muted">{label}</span>
        {locked && (
          <span className="text-[10px] uppercase tracking-wider text-fg-subtle">Locked</span>
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
  const [showWaConfig, setShowWaConfig] = useState(false);

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
        toast.error(data.error ?? "Couldn't save settings. Please try again.");
        return;
      }
      toast.success('Settings saved.');
      setEditingSection(null);
      setDraft({});
      await reload();
    } catch {
      setSaveError('Network error');
      toast.error("Couldn't save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-fg-muted">
        <Spinner size="lg" />
      </div>
    );
  }
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!summary) return null;

  const { tenant, settings, integrations, locked_fields } = summary;
  const lockedSet = new Set(locked_fields);
  const wa = integrations.whatsapp;

  function isLocked(field: keyof Settings): boolean {
    return lockedSet.has(field);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <p className="text-xs text-fg-muted">
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
        <div className="bg-surface rounded-lg border border-border px-4">
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
                    className="h-8 w-12 rounded border border-border-strong cursor-pointer p-0.5"
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
                      className="text-blue-600 dark:text-blue-400 hover:underline text-xs break-all"
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
                        className="w-4 h-4 rounded-full border border-border-strong"
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
              'buffer_before_minutes',
              'buffer_after_minutes',
            ])
          }
          saving={saving}
        />
        <div className="bg-surface rounded-lg border border-border px-4">
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
              <EditRow label="Buffer before (min)">
                <input
                  type="number"
                  min={0}
                  max={60}
                  step={5}
                  value={draft.buffer_before_minutes ?? 0}
                  onChange={e => patchDraft({ buffer_before_minutes: Number(e.target.value) })}
                  className={inputCls}
                />
                <p className="text-[11px] text-fg-muted mt-1">Prep time blocked before each {terminology.booking.toLowerCase()}.</p>
              </EditRow>
              <EditRow label="Buffer after (min)">
                <input
                  type="number"
                  min={0}
                  max={60}
                  step={5}
                  value={draft.buffer_after_minutes ?? 0}
                  onChange={e => patchDraft({ buffer_after_minutes: Number(e.target.value) })}
                  className={inputCls}
                />
                <p className="text-[11px] text-fg-muted mt-1">Cleanup time blocked after each {terminology.booking.toLowerCase()}.</p>
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
              <Row
                label="Buffer before / after"
                value={`${settings?.buffer_before_minutes ?? 0} / ${settings?.buffer_after_minutes ?? 0} min`}
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
        <div className="bg-surface rounded-lg border border-border px-4">
          {editingSection === 'compliance' ? (
            <>
              <EditRow label="Minimum age" locked={isLocked('age_gate_minimum')}>
                <p className="text-sm text-fg-muted">{settings?.age_gate_minimum}</p>
              </EditRow>
              <EditRow label="Age confirmation">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.require_age_confirm ?? false}
                    onChange={e => patchDraft({ require_age_confirm: e.target.checked })}
                  />
                  <span className="text-sm text-fg">Require clients to confirm age</span>
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

      {/* Integrations */}
      <section>
        <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">
          Integrations
        </h3>
        <div className="bg-surface rounded-lg border border-border px-4">
          <Row
            label="WhatsApp"
            value={
              <span className="inline-flex items-center gap-2">
                {wa.configured ? (
                  <Badge variant="success">
                    Active ({wa.provider === 'meta_whatsapp' ? 'Meta' : 'Twilio'})
                  </Badge>
                ) : (
                  <Badge variant="outline">Not configured</Badge>
                )}
                <button
                  type="button"
                  onClick={() => setShowWaConfig(true)}
                  className="text-xs px-2 py-1 bg-elevated hover:bg-sunken text-fg rounded"
                >
                  Configure
                </button>
              </span>
            }
          />
          <Row
            label="AI assistant"
            value={<Badge variant="outline">Coming soon</Badge>}
          />
          <Row
            label="Email notifications"
            value={<Badge variant="outline">Coming soon</Badge>}
          />
        </div>
      </section>

      {/* Getting started — re-open the onboarding checklist */}
      <section>
        <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">
          Getting started
        </h3>
        <div className="bg-surface rounded-lg border border-border px-4">
          <Row
            label="Setup checklist"
            value={
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new Event(ONBOARDING_REOPEN_EVENT));
                  toast.success('Checklist re-opened — see the top of the dashboard.');
                }}
                className="text-xs px-2 py-1 bg-elevated hover:bg-sunken text-fg rounded"
              >
                Re-open checklist
              </button>
            }
          />
        </div>
      </section>

      {showWaConfig && (
        <WhatsAppConfigModal
          slug={slug}
          onClose={() => setShowWaConfig(false)}
          onSaved={async () => {
            setShowWaConfig(false);
            await reload();
          }}
        />
      )}

      {saveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
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
      <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">{title}</h3>
      {editing ? (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="text-xs px-2 py-1 text-fg-muted hover:bg-elevated rounded"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="text-xs px-3 py-1 bg-fg text-canvas rounded hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onEdit}
          className="text-xs px-2 py-1 bg-elevated hover:bg-sunken text-fg rounded"
        >
          Edit
        </button>
      )}
    </div>
  );
}

/* --------------------------------------------------- WhatsApp config modal */

interface WaState {
  configured: boolean;
  provider: 'twilio_whatsapp' | 'meta_whatsapp' | null;
  is_active: boolean;
  config: { from_number?: string | null; phone_number_id?: string | null; waba_id?: string | null };
}

function WhatsAppConfigModal({
  slug,
  onClose,
  onSaved,
}: {
  slug: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<WaState | null>(null);
  const [provider, setProvider] = useState<'twilio_whatsapp' | 'meta_whatsapp'>('twilio_whatsapp');
  const [fromNumber, setFromNumber] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/${slug}/integrations/whatsapp`)
      .then(res => res.json())
      .then((data: WaState) => {
        if (cancelled) return;
        setCurrent(data);
        if (data.provider) setProvider(data.provider);
        if (data.configured) setIsActive(data.is_active);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { provider, is_active: isActive };
      if (provider === 'twilio_whatsapp') {
        body.from_number = fromNumber;
      } else {
        body.phone_number_id = phoneNumberId;
        if (wabaId.trim()) body.waba_id = wabaId;
      }
      const res = await fetch(`/api/${slug}/integrations/whatsapp`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to save');
        toast.error(data.error ?? "Couldn't save integration. Please try again.");
        return;
      }
      toast.success('WhatsApp integration saved.');
      await onSaved();
    } catch {
      setError('Network error');
      toast.error("Couldn't save integration. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const masked =
    current?.configured && current.provider === provider
      ? provider === 'twilio_whatsapp'
        ? current.config.from_number
        : current.config.phone_number_id
      : null;

  return (
    <Modal title="WhatsApp integration" onClose={onClose} maxWidth="max-w-md">
      {loading ? (
        <div className="flex justify-center py-8 text-fg-muted">
          <Spinner size="md" />
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-xs text-fg-muted">
            Booking confirmations, reminders and cancellations are sent to opted-in
            contacts via WhatsApp. Platform API credentials (Twilio account,
            Meta access token) are managed by Book-IT — you only provide your
            sender identity below.
          </p>

          <div>
            <label className="block text-xs text-fg-muted mb-1" htmlFor="wa-provider">
              Provider
            </label>
            <select
              id="wa-provider"
              value={provider}
              onChange={e => setProvider(e.target.value as 'twilio_whatsapp' | 'meta_whatsapp')}
              className={inputCls}
            >
              <option value="twilio_whatsapp">Twilio WhatsApp</option>
              <option value="meta_whatsapp">Meta WhatsApp (Cloud API)</option>
            </select>
          </div>

          {provider === 'twilio_whatsapp' ? (
            <div>
              <label className="block text-xs text-fg-muted mb-1" htmlFor="wa-from">
                WhatsApp sender number
              </label>
              <input
                id="wa-from"
                type="text"
                required
                value={fromNumber}
                onChange={e => setFromNumber(e.target.value)}
                className={inputCls}
                placeholder={masked ? `Currently ${masked}` : '+31612345678'}
              />
              <p className="text-[11px] text-fg-muted mt-1">
                The Twilio-registered WhatsApp number, in international format.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs text-fg-muted mb-1" htmlFor="wa-pnid">
                  Phone number ID
                </label>
                <input
                  id="wa-pnid"
                  type="text"
                  required
                  value={phoneNumberId}
                  onChange={e => setPhoneNumberId(e.target.value)}
                  className={inputCls}
                  placeholder={masked ? `Currently ${masked}` : '123456789012345'}
                />
                <p className="text-[11px] text-fg-muted mt-1">
                  From Meta Business Manager → WhatsApp → API Setup.
                </p>
              </div>
              <div>
                <label className="block text-xs text-fg-muted mb-1" htmlFor="wa-waba">
                  WhatsApp Business Account ID (optional)
                </label>
                <input
                  id="wa-waba"
                  type="text"
                  value={wabaId}
                  onChange={e => setWabaId(e.target.value)}
                  className={inputCls}
                  placeholder="Optional"
                />
              </div>
            </>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
            />
            <span className="text-sm text-fg">Active</span>
            <span className="text-[11px] text-fg-muted">— messages dispatch only while active</span>
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="text-sm px-3 py-1.5 text-fg hover:bg-elevated rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="text-sm px-4 py-1.5 bg-fg text-canvas rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
