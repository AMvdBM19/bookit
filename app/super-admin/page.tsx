'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type {
  Terminology,
  FeatureFlags,
  ComplianceFlags,
  DefaultSettings,
} from '@/lib/types/tenant-config';
import {
  DEFAULT_TERMINOLOGY,
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_COMPLIANCE_FLAGS,
  TERMINOLOGY_KEYS,
  COMPLIANCE_FLAG_KEYS,
} from '@/lib/types/tenant-config';

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  vertical: string;
  client_mode: 'guest' | 'account';
  is_active: boolean;
  wizard_completed: boolean;
  subscription_tier: string | null;
  staff_count: number;
  booking_count_30d: number;
  created_at: string;
}

interface Stats {
  bookings_by_status_30d: Record<string, number>;
  staff_count: number;
  active_staff_count: number;
  client_count: number;
  guest_count: number;
  whatsapp: { configured: boolean; provider: string | null };
  last_booking_at: string | null;
}

interface TemplateRow {
  id: string;
  slug: string;
  label: string;
  icon: string;
  description: string | null;
  terminology: Terminology;
  feature_flags: FeatureFlags;
  compliance_flags: ComplianceFlags;
  default_settings: DefaultSettings;
  seed_tags: Array<{ name: string; description?: string }>;
  is_active: boolean;
  is_system: boolean;
  sort_order: number;
  tenant_count: number;
}

interface TenantConfigData {
  source_template_slug: string | null;
  terminology: Terminology;
  feature_flags: FeatureFlags;
  compliance_flags: ComplianceFlags;
  updated_at: string;
}

const DEFAULT_SETTINGS: DefaultSettings = {
  client_mode: 'guest',
  booking_confirm_mode: 'staff_must_accept',
  client_approval_mode: 'manual',
  default_slot_minutes: 30,
  deposit_pct: 20,
  deposit_required_above_minutes: 60,
};

const KEY_STORAGE = 'bookit:super_admin_key';

function authHeaders(key: string) {
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function SuperAdminPage() {
  const [apiKey, setApiKey] = useState<string>('');
  const [keyInput, setKeyInput] = useState('');
  const [tab, setTab] = useState<'tenants' | 'templates'>('tenants');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem(KEY_STORAGE) : null;
    if (stored) setApiKey(stored);
  }, []);

  function saveKey(e: React.FormEvent) {
    e.preventDefault();
    if (!keyInput.trim()) return;
    sessionStorage.setItem(KEY_STORAGE, keyInput.trim());
    setApiKey(keyInput.trim());
    setKeyInput('');
  }

  function logout() {
    sessionStorage.removeItem(KEY_STORAGE);
    setApiKey('');
    setError(null);
  }

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-zinc-900 rounded-xl border border-zinc-800 p-8 shadow-lg">
          <h1 className="text-white text-xl font-semibold mb-1">Super Admin</h1>
          <p className="text-zinc-400 text-sm mb-6">Enter your API key to continue.</p>
          <form onSubmit={saveKey} className="space-y-4">
            <input
              type="password"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder="API key"
              autoFocus
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              type="submit"
              className="w-full bg-white text-zinc-900 rounded-lg py-2 text-sm font-medium hover:bg-zinc-100 transition-colors"
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">Book-IT Super Admin</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Tenant & template console</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded"
        >
          Sign out
        </button>
      </header>

      <nav className="bg-white border-b border-zinc-200 px-6 flex gap-1">
        {(['tenants', 'templates'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px capitalize transition-colors ${
              tab === t
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      <main className="p-6">
        {tab === 'tenants' ? (
          <TenantsTab apiKey={apiKey} onAuthError={() => { setError('Invalid API key'); logout(); }} />
        ) : (
          <TemplatesTab apiKey={apiKey} />
        )}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ Tenants */

function TenantsTab({ apiKey, onAuthError }: { apiKey: string; onAuthError: () => void }) {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statsCache, setStatsCache] = useState<Record<string, Stats>>({});
  const [statsLoading, setStatsLoading] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super-admin/tenants', { headers: authHeaders(apiKey) });
      if (res.status === 401) {
        onAuthError();
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load tenants');
        return;
      }
      setTenants(data.tenants ?? []);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [apiKey, onAuthError]);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/super-admin/templates', { headers: authHeaders(apiKey) });
      const data = await res.json();
      if (res.ok) setTemplates(data.templates ?? []);
    } catch {
      /* non-fatal */
    }
  }, [apiKey]);

  useEffect(() => {
    reload();
    loadTemplates();
  }, [reload, loadTemplates]);

  async function toggleActive(t: TenantRow) {
    setBusyId(t.id);
    try {
      const res = await fetch(`/api/super-admin/tenants/${t.id}`, {
        method: 'PATCH',
        headers: authHeaders(apiKey),
        body: JSON.stringify({ is_active: !t.is_active }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Couldn't update tenant. Please try again.");
        return;
      }
      toast.success(t.is_active ? 'Tenant deactivated.' : 'Tenant activated.');
      setTenants(prev => prev.map(r => (r.id === t.id ? { ...r, is_active: !t.is_active } : r)));
    } finally {
      setBusyId(null);
    }
  }

  async function loadStats(tenantId: string) {
    if (statsCache[tenantId]) return;
    setStatsLoading(tenantId);
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/stats`, {
        headers: authHeaders(apiKey),
      });
      const data = await res.json();
      if (res.ok) setStatsCache(prev => ({ ...prev, [tenantId]: data.stats }));
    } finally {
      setStatsLoading(null);
    }
  }

  function toggleExpand(tenantId: string) {
    if (expanded === tenantId) {
      setExpanded(null);
    } else {
      setExpanded(tenantId);
      loadStats(tenantId);
    }
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="text-xs px-3 py-1.5 bg-slate-900 text-white rounded font-medium hover:bg-slate-800"
        >
          + New tenant
        </button>
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading tenants…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Template</th>
                <th className="px-3 py-2">Mode</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Staff</th>
                <th className="px-3 py-2">Bookings (30d)</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-zinc-500 text-sm">
                    No tenants yet.
                  </td>
                </tr>
              ) : (
                tenants.map(t => (
                  <Fragment key={t.id}>
                    <tr className="hover:bg-zinc-50">
                      <td className="px-3 py-3 text-zinc-900 font-medium">{t.name}</td>
                      <td className="px-3 py-3">
                        <code className="text-[11px] text-zinc-600">{t.slug}</code>
                      </td>
                      <td className="px-3 py-3 text-zinc-700">{t.vertical}</td>
                      <td className="px-3 py-3 text-zinc-700">{t.client_mode}</td>
                      <td className="px-3 py-3">
                        {t.is_active ? (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded border bg-emerald-100 text-emerald-800 border-emerald-200">
                            Active
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded border bg-zinc-200 text-zinc-700 border-zinc-300">
                            Inactive
                          </span>
                        )}
                        {!t.wizard_completed && t.is_active && (
                          <span className="ml-1 inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded border bg-amber-100 text-amber-800 border-amber-200">
                            Setup
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-zinc-700">{t.staff_count}</td>
                      <td className="px-3 py-3 text-zinc-700">{t.booking_count_30d}</td>
                      <td className="px-3 py-3 text-[11px] text-zinc-500">
                        {formatDate(t.created_at)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => toggleExpand(t.id)}
                            className="text-xs px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded"
                          >
                            {expanded === t.id ? 'Hide' : 'Details'}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleActive(t)}
                            disabled={busyId === t.id}
                            className="text-xs px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded disabled:opacity-50"
                          >
                            {t.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded === t.id && (
                      <tr>
                        <td colSpan={9} className="px-3 py-3 bg-zinc-50 border-t border-zinc-200">
                          {statsLoading === t.id && (
                            <p className="text-xs text-zinc-500">Loading stats…</p>
                          )}
                          {statsCache[t.id] && <StatsPanel stats={statsCache[t.id]} />}
                          <TenantConfigPanel apiKey={apiKey} tenantId={t.id} templates={templates} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateTenantModal
          apiKey={apiKey}
          templates={templates}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            reload();
          }}
        />
      )}
    </>
  );
}

function StatsPanel({ stats }: { stats: Stats }) {
  const byStatus = stats.bookings_by_status_30d;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
      <Card label="Pending" value={byStatus.pending_staff ?? 0} />
      <Card label="Confirmed" value={byStatus.confirmed ?? 0} />
      <Card label="Completed" value={byStatus.completed ?? 0} />
      <Card label="Cancelled" value={byStatus.cancelled ?? 0} />
      <Card label="Staff" value={`${stats.active_staff_count}/${stats.staff_count} active`} />
      <Card label="Clients" value={stats.client_count} />
      <Card label="Guests" value={stats.guest_count} />
      <Card
        label="WhatsApp"
        value={
          stats.whatsapp.configured
            ? `Yes (${stats.whatsapp.provider === 'meta_whatsapp' ? 'Meta' : 'Twilio'})`
            : 'Not configured'
        }
      />
      <Card
        label="Last booking"
        value={stats.last_booking_at ? new Date(stats.last_booking_at).toLocaleDateString('en-GB') : '—'}
      />
    </div>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded border border-zinc-200 px-3 py-2">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-zinc-900 font-medium mt-0.5">{value}</p>
    </div>
  );
}

function TenantConfigPanel({
  apiKey,
  tenantId,
  templates,
}: {
  apiKey: string;
  tenantId: string;
  templates: TemplateRow[];
}) {
  const [config, setConfig] = useState<TenantConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReset, setShowReset] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/config`, {
        headers: authHeaders(apiKey),
      });
      const data = await res.json();
      if (res.ok) setConfig(data.config);
    } finally {
      setLoading(false);
    }
  }, [apiKey, tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-xs text-zinc-500 mt-3">Loading config…</p>;
  if (!config) return <p className="text-xs text-zinc-500 mt-3">No config stamped for this tenant.</p>;

  const activeFeatures = Object.entries(config.feature_flags)
    .filter(([, v]) => v === true)
    .map(([k]) => k);
  const activeCompliance = Object.entries(config.compliance_flags)
    .filter(([, v]) => v === true)
    .map(([k]) => k);

  return (
    <div className="mt-4 bg-white rounded border border-zinc-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Config</h4>
        <button
          type="button"
          onClick={() => setShowReset(true)}
          className="text-[11px] px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded"
        >
          Reset to template
        </button>
      </div>
      <div className="grid md:grid-cols-3 gap-3 text-xs">
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Source template</p>
          <p className="text-zinc-900 font-mono">{config.source_template_slug ?? '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Terminology</p>
          <p className="text-zinc-800">
            {config.terminology.staff} · {config.terminology.client} · {config.terminology.booking}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Active flags</p>
          <p className="text-zinc-800">
            {activeFeatures.length} feature · {activeCompliance.length} compliance
          </p>
        </div>
      </div>

      {showReset && (
        <ResetConfigModal
          apiKey={apiKey}
          tenantId={tenantId}
          templates={templates}
          currentSlug={config.source_template_slug}
          onClose={() => setShowReset(false)}
          onReset={() => {
            setShowReset(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function ResetConfigModal({
  apiKey,
  tenantId,
  templates,
  currentSlug,
  onClose,
  onReset,
}: {
  apiKey: string;
  tenantId: string;
  templates: TemplateRow[];
  currentSlug: string | null;
  onClose: () => void;
  onReset: () => void;
}) {
  const [slug, setSlug] = useState(currentSlug ?? templates[0]?.slug ?? '');
  const [resetSettings, setResetSettings] = useState(false);
  const [resetTags, setResetTags] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!slug) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/reset-config`, {
        method: 'POST',
        headers: authHeaders(apiKey),
        body: JSON.stringify({ template_slug: slug, reset_settings: resetSettings, reset_tags: resetTags }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to reset config');
        return;
      }
      onReset();
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-semibold text-zinc-900 mb-1">Reset config to template</h3>
        <p className="text-xs text-zinc-500 mb-4">
          This overwrites the tenant&apos;s terminology and flags. Locked settings are preserved.
        </p>
        <div className="space-y-3">
          <Field label="Template" required>
            <select
              value={slug}
              onChange={e => setSlug(e.target.value)}
              className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:outline-none focus:border-zinc-500"
            >
              {templates.map(t => (
                <option key={t.slug} value={t.slug}>
                  {t.label} ({t.slug})
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-xs text-zinc-700">
            <input type="checkbox" checked={resetSettings} onChange={e => setResetSettings(e.target.checked)} />
            Also reset default settings (unlocked only)
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-700">
            <input type="checkbox" checked={resetTags} onChange={e => setResetTags(e.target.checked)} />
            Also reset service tags (replaces existing)
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="text-sm px-3 py-1.5 text-zinc-700 hover:bg-zinc-100 rounded"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="text-sm px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded disabled:opacity-50"
            >
              {submitting ? 'Resetting…' : 'Reset'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateTenantModal({
  apiKey,
  templates,
  onClose,
  onCreated,
}: {
  apiKey: string;
  templates: TemplateRow[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [templateSlug, setTemplateSlug] = useState(templates[0]?.slug ?? '');
  const [businessName, setBusinessName] = useState('');
  const [brandColor, setBrandColor] = useState('#2BB673');
  const [clientModeOverride, setClientModeOverride] = useState<'' | 'guest' | 'account'>('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentPassword, setAgentPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/super-admin/tenants', {
        method: 'POST',
        headers: authHeaders(apiKey),
        body: JSON.stringify({
          name,
          slug,
          template_slug: templateSlug,
          business_name: businessName || undefined,
          brand_color: brandColor || undefined,
          client_mode_override: clientModeOverride || undefined,
          agent_email: agentEmail,
          agent_password: agentPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to create tenant');
        return;
      }
      onCreated();
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-zinc-900">New tenant</h3>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-900">
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Field label="Name" required>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:outline-none focus:border-zinc-500"
              placeholder="Inkhaus Studio"
            />
          </Field>
          <Field label="Slug" required hint="lowercase, hyphens; appears in /book/<slug>">
            <input
              type="text"
              required
              minLength={3}
              pattern="[a-z0-9-]+"
              value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase())}
              className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:outline-none focus:border-zinc-500 font-mono"
              placeholder="inkhaus"
            />
          </Field>
          <Field label="Industry template" required>
            <select
              value={templateSlug}
              onChange={e => setTemplateSlug(e.target.value)}
              required
              className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:outline-none focus:border-zinc-500"
            >
              {templates.length === 0 && <option value="">No templates available</option>}
              {templates.filter(t => t.is_active).map(t => (
                <option key={t.slug} value={t.slug}>
                  {t.icon} {t.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Business name" hint="Defaults to Name">
              <input
                type="text"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:outline-none focus:border-zinc-500"
                placeholder="Optional"
              />
            </Field>
            <Field label="Brand color">
              <input
                type="color"
                value={brandColor}
                onChange={e => setBrandColor(e.target.value)}
                className="w-full h-9 border border-zinc-300 rounded px-1 py-0.5"
              />
            </Field>
          </div>
          <Field label="Client mode override" hint="Leave as template default if unsure">
            <select
              value={clientModeOverride}
              onChange={e => setClientModeOverride(e.target.value as '' | 'guest' | 'account')}
              className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:outline-none focus:border-zinc-500"
            >
              <option value="">Template default</option>
              <option value="guest">Guest</option>
              <option value="account">Account</option>
            </select>
          </Field>
          <Field label="Agent email" required>
            <input
              type="email"
              required
              value={agentEmail}
              onChange={e => setAgentEmail(e.target.value)}
              className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:outline-none focus:border-zinc-500"
              placeholder="agent@example.com"
            />
          </Field>
          <Field label="Initial agent password" required hint="Min 8 chars; share securely">
            <input
              type="text"
              required
              minLength={8}
              value={agentPassword}
              onChange={e => setAgentPassword(e.target.value)}
              className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:outline-none focus:border-zinc-500"
              placeholder="Min. 8 characters"
            />
          </Field>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="text-sm px-3 py-1.5 text-zinc-700 hover:bg-zinc-100 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="text-sm px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create tenant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Templates */

function TemplatesTab({ apiKey }: { apiKey: string }) {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super-admin/templates', { headers: authHeaders(apiKey) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load templates');
        return;
      }
      setTemplates(data.templates ?? []);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function toggleActive(t: TemplateRow) {
    if (t.is_active && !confirm(`Deactivate template "${t.label}"?`)) return;
    setBusyId(t.id);
    try {
      const res = await fetch(`/api/super-admin/templates/${t.id}`, {
        method: 'PATCH',
        headers: authHeaders(apiKey),
        body: JSON.stringify({ is_active: !t.is_active }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Couldn't update template. Please try again.");
        return;
      }
      toast.success(t.is_active ? 'Template deactivated.' : 'Template activated.');
      reload();
    } finally {
      setBusyId(null);
    }
  }

  async function duplicate(t: TemplateRow) {
    setBusyId(t.id);
    try {
      const res = await fetch('/api/super-admin/templates', {
        method: 'POST',
        headers: authHeaders(apiKey),
        body: JSON.stringify({
          slug: `${t.slug}_copy`,
          label: `${t.label} (copy)`,
          icon: t.icon,
          description: t.description,
          terminology: t.terminology,
          feature_flags: t.feature_flags,
          compliance_flags: t.compliance_flags,
          default_settings: t.default_settings,
          seed_tags: t.seed_tags,
          sort_order: t.sort_order,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't duplicate template. Please try again.");
        return;
      }
      toast.success('Template duplicated.');
      reload();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="text-xs px-3 py-1.5 bg-slate-900 text-white rounded font-medium hover:bg-slate-800"
        >
          + Create template
        </button>
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading templates…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                <th className="px-3 py-2">Template</th>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Tenants</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-500 text-sm">
                    No templates yet.
                  </td>
                </tr>
              ) : (
                templates.map(t => (
                  <tr key={t.id} className="hover:bg-zinc-50">
                    <td className="px-3 py-3 text-zinc-900 font-medium">
                      <span className="mr-1.5">{t.icon}</span>
                      {t.label}
                    </td>
                    <td className="px-3 py-3">
                      <code className="text-[11px] text-zinc-600">{t.slug}</code>
                    </td>
                    <td className="px-3 py-3 text-zinc-700">
                      {t.is_system ? 'System' : 'Custom'}
                    </td>
                    <td className="px-3 py-3">
                      {t.is_active ? (
                        <span className="inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded border bg-emerald-100 text-emerald-800 border-emerald-200">
                          Active
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded border bg-zinc-200 text-zinc-700 border-zinc-300">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-zinc-700">{t.tenant_count}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditing(t)}
                          className="text-xs px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicate(t)}
                          disabled={busyId === t.id}
                          className="text-xs px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded disabled:opacity-50"
                        >
                          Duplicate
                        </button>
                        {(!t.is_active || !t.is_system) && (
                          <button
                            type="button"
                            onClick={() => toggleActive(t)}
                            disabled={busyId === t.id}
                            className={`text-xs px-2 py-1 rounded disabled:opacity-50 ${
                              t.is_active
                                ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            {t.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {(showCreate || editing) && (
        <TemplateFormModal
          apiKey={apiKey}
          template={editing}
          onClose={() => {
            setShowCreate(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowCreate(false);
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function TemplateFormModal({
  apiKey,
  template,
  onClose,
  onSaved,
}: {
  apiKey: string;
  template: TemplateRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!template;
  const [slug, setSlug] = useState(template?.slug ?? '');
  const [label, setLabel] = useState(template?.label ?? '');
  const [icon, setIcon] = useState(template?.icon ?? '🏢');
  const [description, setDescription] = useState(template?.description ?? '');
  const [sortOrder, setSortOrder] = useState(template?.sort_order ?? 0);
  const [terminology, setTerminology] = useState<Terminology>(
    template?.terminology ?? { ...DEFAULT_TERMINOLOGY }
  );
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(
    template?.feature_flags ?? { ...DEFAULT_FEATURE_FLAGS }
  );
  const [complianceFlags, setComplianceFlags] = useState<ComplianceFlags>(
    template?.compliance_flags ?? { ...DEFAULT_COMPLIANCE_FLAGS }
  );
  const [defaultSettings, setDefaultSettings] = useState<DefaultSettings>(
    template?.default_settings ?? { ...DEFAULT_SETTINGS }
  );
  const [seedTagsText, setSeedTagsText] = useState(
    (template?.seed_tags ?? []).map(t => t.name).join(', ')
  );
  const [isActive, setIsActive] = useState(template?.is_active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const seed_tags = seedTagsText
      .split(/[\n,]/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(name => ({ name }));

    const payload = {
      label,
      icon,
      description: description || null,
      sort_order: sortOrder,
      terminology,
      feature_flags: featureFlags,
      compliance_flags: complianceFlags,
      default_settings: defaultSettings,
      seed_tags,
    };

    try {
      const res = isEdit
        ? await fetch(`/api/super-admin/templates/${template!.id}`, {
            method: 'PATCH',
            headers: authHeaders(apiKey),
            body: JSON.stringify({ ...payload, is_active: isActive }),
          })
        : await fetch('/api/super-admin/templates', {
            method: 'POST',
            headers: authHeaders(apiKey),
            body: JSON.stringify({ slug, ...payload }),
          });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to save template');
        return;
      }
      onSaved();
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-zinc-900">
            {isEdit ? `Edit template — ${template!.label}` : 'Create template'}
          </h3>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-900">
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Slug" required hint={isEdit ? 'immutable' : undefined}>
              <input
                type="text"
                required
                disabled={isEdit}
                value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase())}
                className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:outline-none focus:border-zinc-500 font-mono disabled:bg-zinc-100"
                placeholder="barbershop"
              />
            </Field>
            <Field label="Icon">
              <EmojiPicker value={icon} onChange={setIcon} />
            </Field>
            <Field label="Sort order">
              <input
                type="number"
                value={sortOrder}
                onChange={e => setSortOrder(Number(e.target.value))}
                className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:outline-none focus:border-zinc-500"
              />
            </Field>
          </div>
          <Field label="Label" required>
            <input
              type="text"
              required
              value={label}
              onChange={e => setLabel(e.target.value)}
              className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:outline-none focus:border-zinc-500"
              placeholder="Barbershop"
            />
          </Field>
          <Field label="Description">
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:outline-none focus:border-zinc-500"
              placeholder="Short description shown on the picker"
            />
          </Field>

          {isEdit && (
            <label className="flex items-center gap-2 text-xs text-zinc-700">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              Active — shown in the tenant wizard &amp; create-tenant picker
            </label>
          )}

          <Section title="Terminology">
            <div className="grid grid-cols-2 gap-2">
              {TERMINOLOGY_KEYS.map(key => (
                <Field key={key} label={key}>
                  <input
                    type="text"
                    value={terminology[key]}
                    onChange={e => setTerminology({ ...terminology, [key]: e.target.value })}
                    className="w-full text-sm border border-zinc-300 rounded px-2 py-1.5 focus:outline-none focus:border-zinc-500"
                  />
                </Field>
              ))}
            </div>
          </Section>

          <Section title="Feature flags">
            <div className="space-y-2">
              <Toggle label="Show age gate step" checked={featureFlags.show_age_gate_step} onChange={v => setFeatureFlags({ ...featureFlags, show_age_gate_step: v })} />
              <Field label="Age gate minimum (blank = none)">
                <input
                  type="number"
                  value={featureFlags.age_gate_minimum ?? ''}
                  onChange={e => setFeatureFlags({ ...featureFlags, age_gate_minimum: e.target.value === '' ? null : Number(e.target.value) })}
                  className="w-full text-sm border border-zinc-300 rounded px-2 py-1.5 focus:outline-none focus:border-zinc-500"
                />
              </Field>
              <Toggle label="Staff require pseudonym" checked={featureFlags.staff_require_pseudonym} onChange={v => setFeatureFlags({ ...featureFlags, staff_require_pseudonym: v })} />
              <Toggle
                label="Deposits supported"
                checked={featureFlags.deposits_supported}
                onChange={v => {
                  setFeatureFlags({ ...featureFlags, deposits_supported: v });
                  // Show deposit fields with sensible defaults when enabling; zero them out when disabling.
                  setDefaultSettings(prev => ({
                    ...prev,
                    deposit_pct: v ? (prev.deposit_pct || 20) : 0,
                    deposit_required_above_minutes: v ? (prev.deposit_required_above_minutes || 60) : 0,
                  }));
                }}
              />
              <Toggle label="Show price to client" checked={featureFlags.show_price_to_client} onChange={v => setFeatureFlags({ ...featureFlags, show_price_to_client: v })} />
              <Toggle label="Require booking notes" checked={featureFlags.require_booking_notes} onChange={v => setFeatureFlags({ ...featureFlags, require_booking_notes: v })} />
              <Field label="Booking notes label">
                <input type="text" value={featureFlags.booking_notes_label} onChange={e => setFeatureFlags({ ...featureFlags, booking_notes_label: e.target.value })} className="w-full text-sm border border-zinc-300 rounded px-2 py-1.5 focus:outline-none focus:border-zinc-500" />
              </Field>
              <Field label="Booking notes placeholder">
                <input type="text" value={featureFlags.booking_notes_placeholder} onChange={e => setFeatureFlags({ ...featureFlags, booking_notes_placeholder: e.target.value })} className="w-full text-sm border border-zinc-300 rounded px-2 py-1.5 focus:outline-none focus:border-zinc-500" />
              </Field>
            </div>
          </Section>

          <Section title="Compliance flags">
            <div className="space-y-2">
              {COMPLIANCE_FLAG_KEYS.map(key => (
                <Toggle
                  key={key}
                  label={key}
                  checked={complianceFlags[key]}
                  onChange={v => setComplianceFlags({ ...complianceFlags, [key]: v })}
                />
              ))}
            </div>
          </Section>

          <Section title="Default settings">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Client mode">
                <select value={defaultSettings.client_mode} onChange={e => setDefaultSettings({ ...defaultSettings, client_mode: e.target.value as DefaultSettings['client_mode'] })} className="w-full text-sm border border-zinc-300 rounded px-2 py-1.5">
                  <option value="guest">guest</option>
                  <option value="account">account</option>
                </select>
              </Field>
              <Field label="Booking confirm mode">
                <select value={defaultSettings.booking_confirm_mode} onChange={e => setDefaultSettings({ ...defaultSettings, booking_confirm_mode: e.target.value as DefaultSettings['booking_confirm_mode'] })} className="w-full text-sm border border-zinc-300 rounded px-2 py-1.5">
                  <option value="staff_must_accept">staff_must_accept</option>
                  <option value="auto_confirm">auto_confirm</option>
                </select>
              </Field>
              <Field label="Client approval mode">
                <select value={defaultSettings.client_approval_mode} onChange={e => setDefaultSettings({ ...defaultSettings, client_approval_mode: e.target.value as DefaultSettings['client_approval_mode'] })} className="w-full text-sm border border-zinc-300 rounded px-2 py-1.5">
                  <option value="manual">manual</option>
                  <option value="auto">auto</option>
                </select>
              </Field>
              <Field label="Default slot minutes">
                <input type="number" value={defaultSettings.default_slot_minutes} onChange={e => setDefaultSettings({ ...defaultSettings, default_slot_minutes: Number(e.target.value) })} className="w-full text-sm border border-zinc-300 rounded px-2 py-1.5" />
              </Field>
              {featureFlags.deposits_supported && (
                <>
                  <Field label="Deposit %">
                    <input type="number" value={defaultSettings.deposit_pct} onChange={e => setDefaultSettings({ ...defaultSettings, deposit_pct: Number(e.target.value) })} className="w-full text-sm border border-zinc-300 rounded px-2 py-1.5" />
                  </Field>
                  <Field label="Deposit above (min)">
                    <input type="number" value={defaultSettings.deposit_required_above_minutes} onChange={e => setDefaultSettings({ ...defaultSettings, deposit_required_above_minutes: Number(e.target.value) })} className="w-full text-sm border border-zinc-300 rounded px-2 py-1.5" />
                  </Field>
                </>
              )}
            </div>
          </Section>

          <Section title="Seed tags">
            <Field label="Tag names (comma or newline separated)">
              <textarea
                value={seedTagsText}
                onChange={e => setSeedTagsText(e.target.value)}
                rows={3}
                className="w-full text-sm border border-zinc-300 rounded px-2 py-1.5 focus:outline-none focus:border-zinc-500"
                placeholder="Haircut, Beard trim, Shave"
              />
            </Field>
          </Section>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="text-sm px-3 py-1.5 text-zinc-700 hover:bg-zinc-100 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="text-sm px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded disabled:opacity-50"
            >
              {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Curated set of business-relevant emojis for the template icon picker.
const EMOJI_OPTIONS = [
  '🏢', '💼', '🏪', '🏬', '🏥', '🏫', '🏦', '🏭', '🏗️',
  '✂️', '💅', '💇', '💋', '🖊️', '🔧', '🔨', '🛠️', '⚙️', '🚗',
  '🏋️', '🧘', '💆', '🩺', '🦷', '👁️', '❤️', '🧬',
  '🍽️', '☕', '🍕', '🍰', '🥐', '🍺', '🍷',
  '🎨', '📸', '🎵', '🎬', '📚', '✏️', '🎭', '🎪',
  '💻', '📱', '🖥️', '🌐', '🤖', '🎮',
  '⭐', '🌟', '🔥', '💎', '🎯', '🚀', '👑', '🌈',
];

function EmojiPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-label="Choose an emoji"
          className="flex h-9 w-11 shrink-0 items-center justify-center text-xl border border-zinc-300 rounded hover:bg-zinc-50 focus:outline-none focus:border-zinc-500"
        >
          {value || '🏢'}
        </button>
        {/* Text input kept as a fallback for emojis not in the curated grid. */}
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          maxLength={4}
          className="w-full min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 focus:outline-none focus:border-zinc-500"
        />
      </div>
      {open && (
        <div className="absolute z-20 mt-1 left-0 w-64 bg-white border border-zinc-200 rounded-lg shadow-lg p-2 grid grid-cols-8 gap-1">
          {EMOJI_OPTIONS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onChange(emoji);
                setOpen(false);
              }}
              className={`flex h-7 w-7 items-center justify-center text-lg rounded hover:bg-zinc-100 ${
                value === emoji ? 'bg-zinc-200' : ''
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="border border-zinc-200 rounded-lg" open>
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-zinc-700 uppercase tracking-wider select-none">
        {title}
      </summary>
      <div className="px-3 pb-3 pt-1">{children}</div>
    </details>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-zinc-700">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <code className="text-[11px]">{label}</code>
    </label>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs text-zinc-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-zinc-500 mt-1">{hint}</p>}
    </div>
  );
}
