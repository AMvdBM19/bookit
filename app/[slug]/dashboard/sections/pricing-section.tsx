'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTenantConfig } from '@/lib/context/tenant-config';

interface Settings {
  currency: string;
  base_rate_per_30min: number;
  pricing_enabled: boolean;
  show_price_to_client: boolean;
  tax_rate_pct: number;
  tax_label: string;
  tax_period: string;
  staff_payout_pct: number;
  agency_share_pct: number;
  deposit_pct: number | null;
  deposit_required_above_minutes: number | null;
  no_show_revenue_policy: string;
  no_show_partial_pct: number;
}

interface Summary {
  settings: Settings | null;
  locked_fields: string[];
}

interface ServiceTag {
  id: string;
  name: string;
  description: string | null;
  extra_price: number;
  is_active: boolean;
  display_order: number;
}

const inputCls =
  'w-full text-sm bg-elevated text-fg border border-border rounded px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-border-strong';

const TAX_PERIODS = ['monthly', 'quarterly', 'yearly'] as const;

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function money(amount: unknown, currency: string): string {
  const n = num(amount);
  try {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: currency || 'EUR',
    }).format(n);
  } catch {
    return `${currency || 'EUR'} ${n.toFixed(2)}`;
  }
}

function noShowLabel(policy: string | undefined, partialPct: unknown): string {
  switch (policy) {
    case 'full':
      return 'Full revenue on no-show';
    case 'partial':
      return `${num(partialPct)}% revenue on no-show`;
    case 'zero':
    default:
      return 'No revenue on no-show';
  }
}

export default function PricingSection({ slug }: { slug: string }) {
  const { featureFlags } = useTenantConfig();
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
        setError(data.error ?? 'Failed to load pricing');
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

  if (loading) return <p className="text-sm text-fg-muted">Loading pricing…</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!summary) return null;

  const { settings } = summary;
  const currency = settings?.currency ?? 'EUR';

  // Live split values while editing (linked), otherwise the saved values.
  const splitEditing = editingSection === 'revenue';
  const staffPct = splitEditing ? num(draft.staff_payout_pct) : num(settings?.staff_payout_pct);
  const agencyPct = splitEditing ? num(draft.agency_share_pct) : num(settings?.agency_share_pct);

  return (
    <div className="space-y-6 max-w-2xl">
      <p className="text-xs text-fg-muted">
        Configure rates, tax, revenue split and per-service pricing. Locked fields were set during
        onboarding and require support to change.
      </p>

      {/* Base Pricing */}
      <section>
        <SectionHeader
          title="Base Pricing"
          editing={editingSection === 'base'}
          onEdit={() => startEdit('base')}
          onCancel={cancelEdit}
          onSave={() => saveSection(['pricing_enabled', 'show_price_to_client'])}
          saving={saving}
        />
        <div className="bg-surface rounded-lg border border-border px-4">
          {editingSection === 'base' ? (
            <>
              <EditRow label="Pricing enabled">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.pricing_enabled ?? false}
                    onChange={e => patchDraft({ pricing_enabled: e.target.checked })}
                  />
                  <span className="text-sm text-fg">Enable pricing for this tenant</span>
                </label>
              </EditRow>
              <EditRow label="Show price to client">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.show_price_to_client ?? false}
                    onChange={e => patchDraft({ show_price_to_client: e.target.checked })}
                  />
                  <span className="text-sm text-fg">Display pricing in the booking widget</span>
                </label>
              </EditRow>
              <EditRow label="Currency" locked>
                <p className="text-sm text-fg-muted">{currency}</p>
              </EditRow>
              <EditRow label="Base rate" locked>
                <p className="text-sm text-fg-muted">
                  {money(settings?.base_rate_per_30min, currency)} / 30 min
                </p>
              </EditRow>
            </>
          ) : (
            <>
              <Row label="Pricing enabled" value={settings?.pricing_enabled ? 'Yes' : 'No'} />
              <Row
                label="Base rate"
                value={`${money(settings?.base_rate_per_30min, currency)} / 30 min`}
              />
              <Row label="Currency" value={currency} />
              <Row
                label="Show price to client"
                value={settings?.show_price_to_client ? 'Yes' : 'No'}
              />
            </>
          )}
        </div>
      </section>

      {/* Tax Configuration */}
      <section>
        <SectionHeader
          title="Tax"
          editing={editingSection === 'tax'}
          onEdit={() => startEdit('tax')}
          onCancel={cancelEdit}
          onSave={() => saveSection(['tax_label', 'tax_period'])}
          saving={saving}
        />
        <div className="bg-surface rounded-lg border border-border px-4">
          {editingSection === 'tax' ? (
            <>
              <EditRow label="Tax rate" locked>
                <p className="text-sm text-fg-muted">{num(settings?.tax_rate_pct)}%</p>
              </EditRow>
              <EditRow label="Tax label">
                <input
                  type="text"
                  value={draft.tax_label ?? ''}
                  onChange={e => patchDraft({ tax_label: e.target.value })}
                  className={inputCls}
                  placeholder="BTW"
                />
              </EditRow>
              <EditRow label="Tax period">
                <select
                  value={draft.tax_period ?? 'quarterly'}
                  onChange={e => patchDraft({ tax_period: e.target.value })}
                  className={inputCls}
                >
                  {TAX_PERIODS.map(p => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </EditRow>
            </>
          ) : (
            <Row
              label="Tax"
              value={`${num(settings?.tax_rate_pct)}% ${settings?.tax_label ?? ''} (${
                settings?.tax_period ?? '—'
              })`}
            />
          )}
        </div>
      </section>

      {/* Revenue Split */}
      <section>
        <SectionHeader
          title="Revenue Split"
          editing={editingSection === 'revenue'}
          onEdit={() => startEdit('revenue')}
          onCancel={cancelEdit}
          onSave={() => saveSection(['staff_payout_pct', 'agency_share_pct'])}
          saving={saving}
        />
        <div className="bg-surface rounded-lg border border-border px-4 py-3 space-y-3">
          {editingSection === 'revenue' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-fg-muted mb-1">Staff payout %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={staffPct}
                  onChange={e => {
                    const v = Math.max(0, Math.min(100, num(e.target.value)));
                    patchDraft({ staff_payout_pct: v, agency_share_pct: 100 - v });
                  }}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-fg-muted mb-1">Agency share %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={agencyPct}
                  onChange={e => {
                    const v = Math.max(0, Math.min(100, num(e.target.value)));
                    patchDraft({ agency_share_pct: v, staff_payout_pct: 100 - v });
                  }}
                  className={inputCls}
                />
              </div>
            </div>
          ) : (
            <div className="flex justify-between text-sm">
              <span className="text-fg-muted">Staff / Agency</span>
              <span className="text-fg font-medium">
                {staffPct}% / {agencyPct}%
              </span>
            </div>
          )}
          <SplitBar staffPct={staffPct} agencyPct={agencyPct} />
        </div>
      </section>

      {/* Deposits — only when the template supports them */}
      {featureFlags.deposits_supported && (
        <section>
          <SectionHeader
            title="Deposits"
            editing={editingSection === 'deposits'}
            onEdit={() => startEdit('deposits')}
            onCancel={cancelEdit}
            onSave={() => saveSection(['deposit_pct', 'deposit_required_above_minutes'])}
            saving={saving}
          />
          <div className="bg-surface rounded-lg border border-border px-4">
            {editingSection === 'deposits' ? (
              <>
                <EditRow label="Deposit % of total">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={draft.deposit_pct ?? 0}
                    onChange={e => patchDraft({ deposit_pct: num(e.target.value) })}
                    className={inputCls}
                  />
                </EditRow>
                <EditRow label="Required for bookings over (minutes)">
                  <input
                    type="number"
                    min={0}
                    value={draft.deposit_required_above_minutes ?? 0}
                    onChange={e =>
                      patchDraft({ deposit_required_above_minutes: num(e.target.value) })
                    }
                    className={inputCls}
                  />
                  <p className="text-[11px] text-fg-muted mt-1">
                    0 = always required when deposit % &gt; 0
                  </p>
                </EditRow>
              </>
            ) : (
              <>
                <Row
                  label="Deposit %"
                  value={settings?.deposit_pct != null ? `${settings.deposit_pct}%` : '0%'}
                />
                <Row
                  label="Required above"
                  value={
                    settings?.deposit_required_above_minutes != null
                      ? `${settings.deposit_required_above_minutes} min`
                      : '—'
                  }
                />
              </>
            )}
          </div>
        </section>
      )}

      {/* No-Show Policy */}
      <section>
        <SectionHeader
          title="No-Show Policy"
          editing={editingSection === 'noshow'}
          onEdit={() => startEdit('noshow')}
          onCancel={cancelEdit}
          onSave={() => saveSection(['no_show_revenue_policy', 'no_show_partial_pct'])}
          saving={saving}
        />
        <div className="bg-surface rounded-lg border border-border px-4">
          {editingSection === 'noshow' ? (
            <>
              <EditRow label="Policy">
                <select
                  value={draft.no_show_revenue_policy ?? 'zero'}
                  onChange={e => patchDraft({ no_show_revenue_policy: e.target.value })}
                  className={inputCls}
                >
                  <option value="zero">No revenue</option>
                  <option value="full">Full revenue</option>
                  <option value="partial">Partial revenue</option>
                </select>
              </EditRow>
              {draft.no_show_revenue_policy === 'partial' && (
                <EditRow label="Partial revenue %">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={draft.no_show_partial_pct ?? 0}
                    onChange={e => patchDraft({ no_show_partial_pct: num(e.target.value) })}
                    className={inputCls}
                  />
                </EditRow>
              )}
            </>
          ) : (
            <Row
              label="On no-show"
              value={noShowLabel(settings?.no_show_revenue_policy, settings?.no_show_partial_pct)}
            />
          )}
        </div>
      </section>

      {saveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {saveError}
        </div>
      )}

      {/* Per-Service Pricing */}
      <PerServicePricing slug={slug} currency={currency} />
    </div>
  );
}

function SplitBar({ staffPct, agencyPct }: { staffPct: number; agencyPct: number }) {
  const total = staffPct + agencyPct;
  const valid = Math.abs(total - 100) < 0.001;
  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden bg-sunken">
        <div className="bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, staffPct))}%` }} />
        <div className="bg-slate-400" style={{ width: `${Math.max(0, Math.min(100, agencyPct))}%` }} />
      </div>
      <div className="flex justify-between mt-1 text-[10px] uppercase tracking-wider">
        <span className="text-emerald-700">Staff {staffPct}%</span>
        {!valid && <span className="text-red-500">Must total 100%</span>}
        <span className="text-slate-600">Agency {agencyPct}%</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------ Per-service pricing table */

function PerServicePricing({ slug, currency }: { slug: string; currency: string }) {
  const [tags, setTags] = useState<ServiceTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${slug}/tags`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load services');
        return;
      }
      setTags(data.tags ?? []);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <section>
      <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">
        Per-Service Pricing
      </h3>
      <p className="text-[11px] text-fg-muted mb-2">
        Extra price is the additional charge on top of the base rate for each service type.
      </p>

      {loading && <p className="text-sm text-fg-muted">Loading services…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && !error && (
        <div className="border border-border rounded-lg overflow-hidden bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-elevated border-b border-border">
              <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-fg-muted">
                <th className="px-3 py-2">Service</th>
                <th className="px-3 py-2">Extra price</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tags.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-fg-muted text-sm">
                    No services yet.
                  </td>
                </tr>
              ) : (
                tags.map(tag => (
                  <TagPriceRow key={tag.id} slug={slug} tag={tag} currency={currency} />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TagPriceRow({
  slug,
  tag,
  currency,
}: {
  slug: string;
  tag: ServiceTag;
  currency: string;
}) {
  const [price, setPrice] = useState(String(num(tag.extra_price)));
  const [savedPrice, setSavedPrice] = useState(num(tag.extra_price));
  const [active, setActive] = useState(tag.is_active);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = num(price) !== savedPrice;

  async function patch(updates: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/${slug}/tags/${tag.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed');
        return false;
      }
      return true;
    } catch {
      setError('Network error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function savePrice() {
    const ok = await patch({ extra_price: num(price) });
    if (ok) setSavedPrice(num(price));
  }

  async function toggleActive() {
    const next = !active;
    const ok = await patch({ is_active: next });
    if (ok) setActive(next);
  }

  return (
    <tr className="hover:bg-elevated">
      <td className="px-3 py-3 text-fg">{tag.name}</td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-fg-muted text-xs">{currency}</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={price}
            onChange={e => setPrice(e.target.value)}
            className="w-24 text-sm bg-elevated text-fg border border-border rounded px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-border-strong"
          />
        </div>
        {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
      </td>
      <td className="px-3 py-3">
        <button
          type="button"
          onClick={toggleActive}
          disabled={busy}
          className={`inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded border disabled:opacity-50 ${
            active
              ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30'
              : 'bg-sunken text-fg-muted border-border-strong'
          }`}
        >
          {active ? 'Active' : 'Inactive'}
        </button>
      </td>
      <td className="px-3 py-3 text-right">
        <button
          type="button"
          onClick={savePrice}
          disabled={busy || !dirty}
          className="text-xs px-2 py-1 bg-fg text-canvas rounded hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------- UI helpers */

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
