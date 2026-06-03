'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';

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
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statsCache, setStatsCache] = useState<Record<string, Stats>>({});
  const [statsLoading, setStatsLoading] = useState<string | null>(null);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem(KEY_STORAGE) : null;
    if (stored) setApiKey(stored);
  }, []);

  const reload = useCallback(async () => {
    if (!apiKey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super-admin/tenants', { headers: authHeaders(apiKey) });
      if (res.status === 401) {
        setError('Invalid API key');
        setApiKey('');
        sessionStorage.removeItem(KEY_STORAGE);
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
  }, [apiKey]);

  useEffect(() => {
    if (apiKey) reload();
  }, [apiKey, reload]);

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
    setTenants([]);
    setError(null);
  }

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
        alert(data.error ?? 'Failed to update');
        return;
      }
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
      if (res.ok) {
        setStatsCache(prev => ({ ...prev, [tenantId]: data.stats }));
      }
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
          <p className="text-[11px] text-slate-400 mt-0.5">Tenant management console</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="text-xs px-3 py-1.5 bg-white text-slate-900 rounded font-medium hover:bg-zinc-100"
          >
            + New tenant
          </button>
          <button
            type="button"
            onClick={logout}
            className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="p-6">
        {loading && <p className="text-sm text-zinc-500">Loading tenants…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && (
          <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Slug</th>
                  <th className="px-3 py-2">Vertical</th>
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
                              {expanded === t.id ? 'Hide' : 'Stats'}
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
                            {statsCache[t.id] && (
                              <StatsPanel stats={statsCache[t.id]} />
                            )}
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
      </main>

      {showCreate && (
        <CreateTenantModal
          apiKey={apiKey}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            reload();
          }}
        />
      )}
    </div>
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

function CreateTenantModal({
  apiKey,
  onClose,
  onCreated,
}: {
  apiKey: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [vertical, setVertical] = useState<'tattoo' | 'adult_services'>('tattoo');
  const [clientMode, setClientMode] = useState<'guest' | 'account'>('guest');
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
          vertical,
          client_mode: clientMode,
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vertical" required>
              <select
                value={vertical}
                onChange={e => setVertical(e.target.value as 'tattoo' | 'adult_services')}
                className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:outline-none focus:border-zinc-500"
              >
                <option value="tattoo">Tattoo</option>
                <option value="adult_services">Adult Services</option>
              </select>
            </Field>
            <Field label="Client mode" required>
              <select
                value={clientMode}
                onChange={e => setClientMode(e.target.value as 'guest' | 'account')}
                className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:outline-none focus:border-zinc-500"
              >
                <option value="guest">Guest</option>
                <option value="account">Account</option>
              </select>
            </Field>
          </div>
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
