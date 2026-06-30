'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTenantConfig } from '@/lib/context/tenant-config';
import Spinner from '@/components/ui/spinner';
import Badge from '@/components/ui/badge';
import Modal from '@/components/ui/modal';
import ConfirmDialog from '@/components/ui/confirm-dialog';
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
  default_slot_minutes: number;
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
  terms_url?: string | null;
  privacy_url?: string | null;
}

interface Summary {
  tenant: Tenant | null;
  settings: Settings | null;
  locked_fields: string[];
  integrations: {
    whatsapp: { configured: boolean; provider: string | null };
    email?: { configured: boolean };
    mollie?: { configured: boolean; mode: 'test' | 'live' | null };
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
  const [showEmailConfig, setShowEmailConfig] = useState(false);
  const [showMollieConfig, setShowMollieConfig] = useState(false);

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
              'default_slot_minutes',
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
              <EditRow label="Default slot duration (min)">
                <input
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  value={draft.default_slot_minutes ?? 30}
                  onChange={e => patchDraft({ default_slot_minutes: Number(e.target.value) })}
                  className={inputCls}
                />
                <p className="text-[11px] text-fg-muted mt-1">Base duration for each {terminology.booking.toLowerCase()}.</p>
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
              <Row label="Default slot duration" value={`${settings?.default_slot_minutes ?? 30} min`} />
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

      {/* Business Hours */}
      <BusinessHoursSection slug={slug} />

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

      {/* Booking form fields moved to the Widget customizer (Fix 2) so changes
          can be previewed live alongside the widget. */}
      <section>
        <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">
          Booking form
        </h3>
        <div className="bg-surface rounded-lg border border-border px-4 py-3">
          <p className="text-sm text-fg-muted">
            Custom booking-form fields are now managed in the{' '}
            <span className="text-fg font-medium">Widget</span> tab, where you can
            add, edit and reorder them while previewing the booking widget live.
          </p>
        </div>
      </section>

      {/* Staff permissions (tenant_config flags) */}
      <BookingFormSection slug={slug} />

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
            label="Email notifications"
            value={
              <span className="inline-flex items-center gap-2">
                {integrations.email?.configured ? (
                  <Badge variant="success">Active</Badge>
                ) : (
                  <Badge variant="outline">Not configured</Badge>
                )}
                <button
                  type="button"
                  onClick={() => setShowEmailConfig(true)}
                  className="text-xs px-2 py-1 bg-elevated hover:bg-sunken text-fg rounded"
                >
                  Configure
                </button>
              </span>
            }
          />
          <Row
            label="Payments (Mollie)"
            value={
              <span className="inline-flex items-center gap-2">
                {integrations.mollie?.configured ? (
                  integrations.mollie.mode === 'test' ? (
                    <Badge variant="warning">Test mode</Badge>
                  ) : (
                    <Badge variant="success">Active (Mollie)</Badge>
                  )
                ) : (
                  <Badge variant="outline">Not configured</Badge>
                )}
                <button
                  type="button"
                  onClick={() => setShowMollieConfig(true)}
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
        </div>
      </section>

      {/* Legal / GDPR */}
      <section>
        <SectionHeader
          title="Legal"
          editing={editingSection === 'legal'}
          onEdit={() => startEdit('legal')}
          onCancel={cancelEdit}
          onSave={() => saveSection(['terms_url', 'privacy_url'])}
          saving={saving}
        />
        <div className="bg-surface rounded-lg border border-border px-4">
          {editingSection === 'legal' ? (
            <>
              <EditRow label="Terms & Conditions URL">
                <input
                  type="url"
                  value={draft.terms_url ?? ''}
                  onChange={e => patchDraft({ terms_url: e.target.value || null })}
                  className={inputCls}
                  placeholder="https://..."
                />
              </EditRow>
              <EditRow label="Privacy Policy URL">
                <input
                  type="url"
                  value={draft.privacy_url ?? ''}
                  onChange={e => patchDraft({ privacy_url: e.target.value || null })}
                  className={inputCls}
                  placeholder="https://..."
                />
              </EditRow>
            </>
          ) : (
            <>
              <Row
                label="Terms & Conditions"
                value={
                  settings?.terms_url ? (
                    <a href={settings.terms_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline text-xs break-all">
                      {settings.terms_url}
                    </a>
                  ) : 'Not set'
                }
              />
              <Row
                label="Privacy Policy"
                value={
                  settings?.privacy_url ? (
                    <a href={settings.privacy_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline text-xs break-all">
                      {settings.privacy_url}
                    </a>
                  ) : 'Not set'
                }
              />
            </>
          )}
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

      {showEmailConfig && (
        <EmailConfigModal
          slug={slug}
          onClose={() => setShowEmailConfig(false)}
          onSaved={async () => {
            setShowEmailConfig(false);
            await reload();
          }}
        />
      )}

      {showMollieConfig && (
        <MollieConfigModal
          slug={slug}
          onClose={() => setShowMollieConfig(false)}
          onSaved={async () => {
            setShowMollieConfig(false);
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

/* ------------------------------------------------ Business hours section */

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface BusinessHour {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_active: boolean;
}

function BusinessHoursSection({ slug }: { slug: string }) {
  const { terminology } = useTenantConfig();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [editing, setEditing] = useState(false);
  const [draftEnabled, setDraftEnabled] = useState(false);
  const [draftHours, setDraftHours] = useState<BusinessHour[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/${slug}/business-hours`);
      const data = await res.json();
      if (res.ok) {
        setEnabled(data.enabled);
        const rows: BusinessHour[] = data.hours ?? [];
        const full = [1, 2, 3, 4, 5, 6, 0].map(day => {
          const existing = rows.find(h => h.day_of_week === day);
          return existing ?? { day_of_week: day, open_time: '09:00', close_time: '17:00', is_active: false };
        });
        setHours(full);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  function startEdit() {
    setDraftEnabled(enabled);
    setDraftHours(hours.map(h => ({ ...h })));
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
  }

  function updateDay(dayOfWeek: number, updates: Partial<BusinessHour>) {
    setDraftHours(prev => prev.map(h =>
      h.day_of_week === dayOfWeek ? { ...h, ...updates } : h
    ));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/${slug}/business-hours`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: draftEnabled, hours: draftHours }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't save business hours.");
        return;
      }
      toast.success('Business hours saved.');
      setEditing(false);
      await load();
    } catch {
      toast.error("Couldn't save business hours.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <section>
      <SectionHeader
        title="Business Hours"
        editing={editing}
        onEdit={startEdit}
        onCancel={cancel}
        onSave={save}
        saving={saving}
      />
      <div className="bg-surface rounded-lg border border-border px-4">
        {editing ? (
          <div className="py-3 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draftEnabled}
                onChange={e => setDraftEnabled(e.target.checked)}
              />
              <span className="text-sm text-fg">Enable business hours</span>
            </label>
            <p className="text-[11px] text-fg-muted">
              {draftEnabled
                ? `Customers can book any time your business is open. You assign a ${terminology.staff.toLowerCase()} afterward.`
                : `Customers can only book when a specific ${terminology.staff.toLowerCase()} is available.`}
            </p>
            <div className="space-y-1">
              {[1, 2, 3, 4, 5, 6, 0].map(day => {
                const row = draftHours.find(h => h.day_of_week === day);
                if (!row) return null;
                return (
                  <div key={day} className="flex items-center gap-3 py-1">
                    <label className="flex items-center gap-2 w-24 shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={row.is_active}
                        onChange={e => updateDay(day, { is_active: e.target.checked })}
                      />
                      <span className={`text-xs ${row.is_active ? 'text-fg' : 'text-fg-muted'}`}>
                        {DAY_LABELS[day]}
                      </span>
                    </label>
                    {row.is_active ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="time"
                          value={row.open_time}
                          onChange={e => updateDay(day, { open_time: e.target.value })}
                          className={inputCls + ' w-24 text-xs'}
                        />
                        <span className="text-xs text-fg-muted">–</span>
                        <input
                          type="time"
                          value={row.close_time}
                          onChange={e => updateDay(day, { close_time: e.target.value })}
                          className={inputCls + ' w-24 text-xs'}
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-fg-muted">Closed</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="py-1">
            <Row label="Business hours" value={enabled ? 'Enabled' : 'Disabled (staff availability only)'} />
            {enabled && hours.filter(h => h.is_active).map(h => (
              <Row
                key={h.day_of_week}
                label={DAY_LABELS[h.day_of_week]}
                value={`${h.open_time} – ${h.close_time}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Staff-permission flags live on tenant_config.feature_flags (not
 * tenant_settings), so this section talks to /api/{slug}/config. The PATCH
 * validator requires the full flag object — toggles merge into the fetched
 * flags before saving. (The booking-form fields themselves are managed by the
 * BookingFormBuilder above; the legacy reference-image/address flags are now
 * builder-driven and no longer toggled here.)
 */
function BookingFormSection({ slug }: { slug: string }) {
  const [flags, setFlags] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/${slug}/config`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          setFlags(data.config?.feature_flags ?? null);
        }
      } catch {
        /* section simply stays hidden on failure */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function toggle(
    key: 'staff_can_edit_bookings',
    next: boolean
  ) {
    if (!flags) return;
    const updated = { ...flags, [key]: next };
    setSaving(true);
    try {
      const res = await fetch(`/api/${slug}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature_flags: updated }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't save. Please try again.");
        return;
      }
      setFlags(updated);
      toast.success('Booking form updated.');
    } catch {
      toast.error("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!flags) return null;

  return (
    <section>
      <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">
        Staff permissions
      </h3>
      <div className="bg-surface rounded-lg border border-border px-4 py-1">
        <div className="py-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={flags.staff_can_edit_bookings === true}
              disabled={saving}
              onChange={e => toggle('staff_can_edit_bookings', e.target.checked)}
            />
            <span className="text-sm text-fg">Staff can edit bookings</span>
          </label>
          <p className="text-[11px] text-fg-muted mt-1 ml-6">
            Lets team members edit services, notes and price on their own
            bookings. Every edit is recorded in an audit trail.
          </p>
        </div>
      </div>
    </section>
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

/* ------------------------------------------------------ Email config modal */

interface EmailState {
  configured: boolean;
  is_active: boolean;
  config: { reply_to?: string | null; resend_api_key?: string | null; sending_domain?: string | null };
  has_own_key?: boolean;
  domain_status?: string | null;
  sender_name: string | null;
  sender_name_fallback: string | null;
}

function EmailConfigModal({
  slug,
  onClose,
  onSaved,
}: {
  slug: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<EmailState | null>(null);
  const [senderName, setSenderName] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [sendingDomain, setSendingDomain] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/${slug}/integrations/email`)
      .then(res => res.json())
      .then((data: EmailState) => {
        if (cancelled) return;
        setCurrent(data);
        setSenderName(data.sender_name ?? '');
        setSendingDomain(data.config?.sending_domain ?? '');
        // Pre-fill the masked key so the field shows a value; the PUT route
        // treats a masked value as "unchanged".
        if (data.config?.resend_api_key) setApiKey(data.config.resend_api_key);
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
      const res = await fetch(`/api/${slug}/integrations/email`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_active: isActive,
          sender_name: senderName,
          resend_api_key: apiKey,
          sending_domain: sendingDomain.trim(),
          ...(replyTo.trim() ? { reply_to: replyTo.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to save');
        toast.error(data.error ?? "Couldn't save integration. Please try again.");
        return;
      }
      toast.success('Email integration saved.');
      await onSaved();
    } catch {
      setError('Network error');
      toast.error("Couldn't save integration. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setError(null);
    try {
      const res = await fetch(`/api/${slug}/integrations/email/test`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Test email failed');
        toast.error(data.error ?? 'Test email failed.');
        return;
      }
      toast.success(`Test email sent to ${data.sent_to}.`);
    } catch {
      toast.error('Test email failed. Please try again.');
    } finally {
      setTesting(false);
    }
  }

  const domainStatus = current?.domain_status ?? null;

  return (
    <Modal title="Email notifications" onClose={onClose} maxWidth="max-w-md">
      {loading ? (
        <div className="flex justify-center py-8 text-fg-muted">
          <Spinner size="md" />
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-xs text-fg-muted">
            Booking confirmations, reminders and cancellations are emailed to
            your clients using the templates from the Templates tab. Sending
            infrastructure is managed by Book-IT — emails go out as
            &quot;{senderName.trim() || current?.sender_name_fallback || 'Your business'} via
            Book-IT&quot;.
          </p>

          <div>
            <label className="block text-xs text-fg-muted mb-1" htmlFor="email-sender">
              Sender display name
            </label>
            <input
              id="email-sender"
              type="text"
              value={senderName}
              onChange={e => setSenderName(e.target.value)}
              className={inputCls}
              maxLength={80}
              placeholder={current?.sender_name_fallback ?? 'Your business name'}
            />
            <p className="text-[11px] text-fg-muted mt-1">
              Shown in your clients&apos; inbox. Leave blank to use your display
              name.
            </p>
          </div>

          <div>
            <label className="block text-xs text-fg-muted mb-1" htmlFor="email-replyto">
              Reply-to address (optional)
            </label>
            <input
              id="email-replyto"
              type="email"
              value={replyTo}
              onChange={e => setReplyTo(e.target.value)}
              className={inputCls}
              placeholder={
                current?.config.reply_to ? `Currently ${current.config.reply_to}` : 'you@yourbusiness.nl'
              }
            />
            <p className="text-[11px] text-fg-muted mt-1">
              Client replies go here. Leave blank to keep emails no-reply.
            </p>
          </div>

          {/* Self-service sending: own Resend key + verified domain (Phase 19 A5) */}
          <div className="border-t border-border pt-3 space-y-3">
            <p className="text-xs font-medium text-fg">Send from your own domain (optional)</p>
            <p className="text-[11px] text-fg-muted">
              By default emails are sent via Book-IT&apos;s shared infrastructure.
              To send from your own domain, add a{' '}
              <a
                href="https://resend.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-fg"
              >
                Resend
              </a>{' '}
              API key and verified sending domain.
            </p>

            <div>
              <label className="block text-xs text-fg-muted mb-1" htmlFor="email-apikey">
                Resend API key
              </label>
              <input
                id="email-apikey"
                type="text"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className={inputCls}
                placeholder="re_…"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-[11px] text-fg-muted mt-1">
                Stored encrypted; only the last 4 characters are shown after saving.
              </p>
            </div>

            <div>
              <label className="block text-xs text-fg-muted mb-1" htmlFor="email-domain">
                Sending domain
              </label>
              <input
                id="email-domain"
                type="text"
                value={sendingDomain}
                onChange={e => setSendingDomain(e.target.value)}
                className={inputCls}
                placeholder="mail.yourbusiness.nl"
                autoComplete="off"
                spellCheck={false}
              />
              {sendingDomain.trim() && (
                <p className="text-[11px] text-fg-muted mt-1">
                  Emails will be sent from{' '}
                  <span className="text-fg">
                    {(senderName.trim() || current?.sender_name_fallback || 'bookings')
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '')
                      .slice(0, 30) || 'bookings'}
                    @{sendingDomain.trim()}
                  </span>
                </p>
              )}
            </div>

            {/* Verification status */}
            {current?.has_own_key && current?.config.sending_domain && (
              <div className="text-[11px]">
                {domainStatus === 'verified' ? (
                  <span className="text-emerald-600 dark:text-emerald-400">✓ Domain verified</span>
                ) : domainStatus === 'not_found' ? (
                  <span className="text-amber-600 dark:text-amber-400">
                    Domain not found in your Resend account — add it there first.
                  </span>
                ) : domainStatus ? (
                  <span className="text-amber-600 dark:text-amber-400">
                    Domain status: {domainStatus} — finish the DNS steps below.
                  </span>
                ) : (
                  <span className="text-fg-muted">Could not check verification status.</span>
                )}
              </div>
            )}

            {/* Guided DNS steps appear once a domain is entered */}
            {sendingDomain.trim() && (
              <details className="rounded border border-border bg-elevated p-2">
                <summary className="text-[11px] text-fg cursor-pointer">DNS setup steps</summary>
                <ol className="list-decimal ml-4 mt-2 space-y-1 text-[11px] text-fg-muted">
                  <li>In Resend, go to <span className="text-fg">Domains → Add Domain</span> and enter <span className="text-fg">{sendingDomain.trim()}</span>.</li>
                  <li>Add the <span className="text-fg">MX</span> and <span className="text-fg">TXT (SPF)</span> records Resend shows to your DNS provider.</li>
                  <li>Add the <span className="text-fg">DKIM</span> CNAME/TXT records Resend provides.</li>
                  <li>Optionally add the <span className="text-fg">DMARC</span> TXT record for best deliverability.</li>
                  <li>Click <span className="text-fg">Verify</span> in Resend, then reopen this dialog to confirm the status here.</li>
                </ol>
              </details>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
            />
            <span className="text-sm text-fg">Active</span>
            <span className="text-[11px] text-fg-muted">— emails dispatch only while active</span>
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={sendTest}
              disabled={testing || submitting || !current?.configured}
              title={!current?.configured ? 'Save the integration first' : undefined}
              className="text-sm px-3 py-1.5 bg-elevated text-fg rounded hover:bg-sunken transition-colors disabled:opacity-50"
            >
              {testing ? 'Sending…' : 'Send test email'}
            </button>
            <div className="flex gap-2">
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
          </div>
        </form>
      )}
    </Modal>
  );
}

/* --------------------------------------------------- Terminal devices (Phase 18) */

interface TerminalDevice {
  id: string;
  device_name: string;
  masked_terminal_id: string | null;
  is_active: boolean;
}

function TerminalDevices({ slug }: { slug: string }) {
  const [terminals, setTerminals] = useState<TerminalDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [terminalId, setTerminalId] = useState('');
  const [adding, setAdding] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/${slug}/integrations/mollie/terminals`);
      const data = await res.json().catch(() => ({}));
      setTerminals(data.terminals ?? []);
    } catch {
      setTerminals([]);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!terminalId.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/${slug}/integrations/mollie/terminals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_name: name.trim() || undefined, terminal_id: terminalId.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't add the terminal.");
        return;
      }
      toast.success('Terminal added.');
      setName('');
      setTerminalId('');
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/${slug}/integrations/mollie/terminals?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Couldn't remove the terminal.");
      return;
    }
    toast.success('Terminal removed.');
    await load();
  }

  return (
    <div className="border-t border-border pt-4 mt-4 space-y-3">
      <div>
        <h4 className="text-sm font-medium text-fg">Terminal devices</h4>
        <p className="text-[11px] text-fg-muted mt-0.5">
          Register your Mollie PIN terminals to charge bookings at the counter. Find the
          terminal ID (<code>term_…</code>) in your Mollie dashboard under Point of sale.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-4 text-fg-muted"><Spinner size="sm" /></div>
      ) : terminals.length === 0 ? (
        <p className="text-xs text-fg-muted">No terminals registered yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {terminals.map(t => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-2 text-xs bg-elevated border border-border rounded px-2.5 py-1.5"
            >
              <span className="text-fg">
                {t.device_name}
                <span className="text-fg-muted ml-2 font-mono">{t.masked_terminal_id}</span>
              </span>
              <button
                type="button"
                onClick={() => setConfirmRemoveId(t.id)}
                className="text-fg-muted hover:text-red-500"
                aria-label={`Remove ${t.device_name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[120px]">
          <label className="block text-[11px] text-fg-muted mb-1" htmlFor="term-name">Name</label>
          <input
            id="term-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Front desk"
            className={inputCls}
            autoComplete="off"
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[11px] text-fg-muted mb-1" htmlFor="term-id">Terminal ID</label>
          <input
            id="term-id"
            type="text"
            value={terminalId}
            onChange={e => setTerminalId(e.target.value)}
            placeholder="term_…"
            className={inputCls}
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          disabled={adding || !terminalId.trim()}
          className="text-sm px-3 py-1.5 bg-fg text-canvas rounded hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {adding ? 'Adding…' : 'Add'}
        </button>
      </form>

      {confirmRemoveId && (
        <ConfirmDialog
          title="Remove terminal?"
          description="Bookings can no longer be charged to this terminal."
          confirmLabel="Remove"
          onConfirm={async () => {
            await remove(confirmRemoveId);
            setConfirmRemoveId(null);
          }}
          onClose={() => setConfirmRemoveId(null)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------- Mollie config modal */

interface MollieState {
  configured: boolean;
  is_active: boolean;
  masked_key: string | null;
  mode: 'test' | 'live' | null;
  platform_fallback: boolean;
}

function MollieConfigModal({
  slug,
  onClose,
  onSaved,
}: {
  slug: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<MollieState | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/${slug}/integrations/mollie`)
      .then(res => res.json())
      .then((data: MollieState) => {
        if (cancelled) return;
        setCurrent(data);
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
      const res = await fetch(`/api/${slug}/integrations/mollie`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_active: isActive,
          ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to save');
        toast.error(data.error ?? "Couldn't save integration. Please try again.");
        return;
      }
      toast.success('Mollie integration saved.');
      await onSaved();
    } catch {
      setError('Network error');
      toast.error("Couldn't save integration. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Payments (Mollie)" onClose={onClose} maxWidth="max-w-md">
      {loading ? (
        <div className="flex justify-center py-8 text-fg-muted">
          <Spinner size="md" />
        </div>
      ) : (
        <>
        <form onSubmit={submit} className="space-y-3">
          <p className="text-xs text-fg-muted">
            Collect deposits online when a booking is confirmed. Enter your
            Mollie API key — get one at{' '}
            <a
              href="https://mollie.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-fg"
            >
              mollie.com/dashboard
            </a>
            . A <code>test_</code> key runs in test mode; <code>live_</code>{' '}
            takes real payments.
            {current?.platform_fallback && !current?.masked_key && (
              <> If you leave this blank, the platform&apos;s shared Mollie account is used.</>
            )}
          </p>

          <div>
            <label className="block text-xs text-fg-muted mb-1" htmlFor="mollie-key">
              API key
            </label>
            <input
              id="mollie-key"
              type="text"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className={inputCls}
              placeholder={current?.masked_key ?? 'test_… or live_…'}
              autoComplete="off"
            />
            {current?.masked_key && (
              <p className="text-[11px] text-fg-muted mt-1">
                Leave blank to keep the saved key ({current.masked_key}).
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
            />
            <span className="text-sm text-fg">Active</span>
            <span className="text-[11px] text-fg-muted">— deposits are charged only while active</span>
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
        {current?.configured && current.is_active && <TerminalDevices slug={slug} />}
        </>
      )}
    </Modal>
  );
}
