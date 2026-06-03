'use client';

import { useCallback, useEffect, useState } from 'react';

interface StaffRow {
  id: string;
  pseudonym: string;
  real_name: string | null;
  photo_urls: string[] | null;
  status: 'active' | 'inactive' | 'offline';
  wizard_completed: boolean;
  first_login: boolean;
  created_at: string;
  staff_service_tags: Array<{
    service_tags:
      | { id: string; name: string }
      | Array<{ id: string; name: string }>
      | null;
  }>;
  staff_schedule: Array<{ day_of_week: number }>;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function tagNamesOf(s: StaffRow): string[] {
  const out: string[] = [];
  for (const link of s.staff_service_tags ?? []) {
    const tag = Array.isArray(link.service_tags) ? link.service_tags[0] : link.service_tags;
    if (tag?.name) out.push(tag.name);
  }
  return out;
}

function scheduleDaysOf(s: StaffRow): string {
  const days = Array.from(new Set((s.staff_schedule ?? []).map(d => d.day_of_week))).sort();
  if (days.length === 0) return '—';
  return days.map(d => DAY_LABELS[d]).join(' ');
}

function initialOf(name: string): string {
  return (name?.[0] ?? '?').toUpperCase();
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  inactive: 'bg-zinc-200 text-zinc-700 border-zinc-300',
  offline: 'bg-amber-100 text-amber-800 border-amber-200',
};

export default function StaffSection({ slug }: { slug: string }) {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${slug}/staff`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load staff');
        return;
      }
      setStaff(data.staff ?? []);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function toggleStatus(s: StaffRow) {
    const next = s.status === 'active' ? 'inactive' : 'active';
    setBusyId(s.id);
    try {
      const res = await fetch(`/api/${slug}/staff/${s.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? 'Failed to update status');
        return;
      }
      setStaff(prev => prev.map(r => (r.id === s.id ? { ...r, status: next } : r)));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">Staff</h2>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="text-xs px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded"
        >
          + Add staff
        </button>
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading staff…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Profile</th>
                <th className="px-3 py-2">Tags</th>
                <th className="px-3 py-2">Schedule</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-zinc-500 text-sm">
                    No staff yet.
                  </td>
                </tr>
              ) : (
                staff.map(s => {
                  const tags = tagNamesOf(s);
                  const photo = s.photo_urls?.[0];
                  const isInvited = s.first_login && !s.wizard_completed;
                  return (
                    <tr key={s.id} className="hover:bg-zinc-50">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photo}
                              alt={s.pseudonym}
                              className="w-7 h-7 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-[11px] font-semibold">
                              {initialOf(s.pseudonym)}
                            </div>
                          )}
                          <div>
                            <p className="text-zinc-900 font-medium">{s.pseudonym}</p>
                            {s.real_name && (
                              <p className="text-[11px] text-zinc-500">{s.real_name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded border ${
                            STATUS_BADGE[s.status] ?? STATUS_BADGE.inactive
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {isInvited ? (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded border bg-amber-100 text-amber-800 border-amber-200">
                            Invited
                          </span>
                        ) : s.wizard_completed ? (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded border bg-emerald-100 text-emerald-800 border-emerald-200">
                            Complete
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded border bg-zinc-200 text-zinc-700 border-zinc-300">
                            Setup pending
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {tags.slice(0, 3).map(t => (
                            <span
                              key={t}
                              className="bg-zinc-100 text-zinc-700 text-[10px] px-1.5 py-0.5 rounded border border-zinc-200"
                            >
                              {t}
                            </span>
                          ))}
                          {tags.length > 3 && (
                            <span className="text-[10px] text-zinc-500">+{tags.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-zinc-700 text-xs">
                        {scheduleDaysOf(s)}
                      </td>
                      <td className="px-3 py-3 text-[11px] text-zinc-500">
                        {new Date(s.created_at).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => toggleStatus(s)}
                          disabled={busyId === s.id}
                          className="text-xs px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded disabled:opacity-50"
                        >
                          {s.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateStaffModal
          slug={slug}
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

function CreateStaffModal({
  slug,
  onClose,
  onCreated,
}: {
  slug: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState('');
  const [pseudonym, setPseudonym] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/${slug}/staff/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pseudonym, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to create staff');
        return;
      }
      setSuccess(true);
      window.setTimeout(onCreated, 800);
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-zinc-900">Add staff</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-900"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {success ? (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
            Staff created. They can sign in with the password you set, then they&apos;ll be prompted
            to change it on first login.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-xs text-zinc-600 mb-1" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:outline-none focus:border-zinc-500"
                placeholder="staff@example.com"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-600 mb-1" htmlFor="pseudonym">
                Display name
              </label>
              <input
                id="pseudonym"
                type="text"
                value={pseudonym}
                onChange={e => setPseudonym(e.target.value)}
                className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:outline-none focus:border-zinc-500"
                placeholder="Pseudonym or display name"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-600 mb-1" htmlFor="password">
                Initial password
              </label>
              <input
                id="password"
                type="text"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:outline-none focus:border-zinc-500"
                placeholder="Min. 8 characters"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Share this password with the staff member. They&apos;ll be forced to change it on first login.
              </p>
            </div>
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
                {submitting ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
