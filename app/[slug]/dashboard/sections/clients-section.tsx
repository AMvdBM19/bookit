'use client';

import { useCallback, useEffect, useState } from 'react';

interface Guest {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  booking_count: number;
  last_seen_at: string;
  created_at: string;
  is_blocked: boolean;
}

interface Client {
  id: string;
  display_name: string;
  email: string;
  phone: string | null;
  status: 'unverified' | 'pending' | 'approved' | 'rejected' | 'suspended';
  created_at: string;
}

const CLIENT_STATUS_COLORS: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  unverified: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  suspended: 'bg-red-100 text-red-800 border-red-200',
  rejected: 'bg-zinc-200 text-zinc-700 border-zinc-300',
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB');
}

interface Props {
  slug: string;
  clientMode: 'guest' | 'account';
}

export default function ClientsSection({ slug, clientMode }: Props) {
  if (clientMode === 'guest') {
    return <GuestList slug={slug} />;
  }
  return <ClientList slug={slug} />;
}

/* -------------------- Guest mode -------------------- */

function GuestList({ slug }: { slug: string }) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blockTarget, setBlockTarget] = useState<Guest | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${slug}/guests`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load guests');
        return;
      }
      setGuests(data.guests ?? []);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (loading) return <p className="text-sm text-zinc-500">Loading guests…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-zinc-900">Guests</h2>

      <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Bookings</th>
              <th className="px-3 py-2">Last seen</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {guests.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-zinc-500 text-sm">
                  No guests yet.
                </td>
              </tr>
            ) : (
              guests.map(g => (
                <tr key={g.id} className={`hover:bg-zinc-50 ${g.is_blocked ? 'opacity-60' : ''}`}>
                  <td className="px-3 py-3 text-zinc-900">{g.name}</td>
                  <td className="px-3 py-3 text-zinc-700">{g.email}</td>
                  <td className="px-3 py-3 text-zinc-700">{g.phone ?? '—'}</td>
                  <td className="px-3 py-3 text-zinc-700">{g.booking_count}</td>
                  <td className="px-3 py-3 text-[11px] text-zinc-500">
                    {formatDateTime(g.last_seen_at)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {g.is_blocked ? (
                      <span className="inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded border bg-red-100 text-red-800 border-red-200">
                        Blocked
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setBlockTarget(g)}
                        className="text-xs px-2 py-1 bg-zinc-100 hover:bg-red-100 hover:text-red-800 text-zinc-800 rounded"
                      >
                        Block
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {blockTarget && (
        <BlockGuestModal
          slug={slug}
          guest={blockTarget}
          onClose={() => setBlockTarget(null)}
          onBlocked={() => {
            setBlockTarget(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function BlockGuestModal({
  slug,
  guest,
  onClose,
  onBlocked,
}: {
  slug: string;
  guest: Guest;
  onClose: () => void;
  onBlocked: () => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/${slug}/guests/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: guest.email, reason: reason || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to block');
        return;
      }
      onBlocked();
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
          <h3 className="text-base font-semibold text-zinc-900">Block guest</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-900"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-zinc-700 mb-3">
          Block <span className="font-medium">{guest.name}</span> ({guest.email}) from making new
          bookings? Existing bookings are not affected.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-600 mb-1" htmlFor="block-reason">
              Reason (optional)
            </label>
            <input
              id="block-reason"
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:outline-none focus:border-zinc-500"
              placeholder="Internal note"
            />
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
              className="text-sm px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50"
            >
              {submitting ? 'Blocking…' : 'Block'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------- Account mode -------------------- */

function ClientList({ slug }: { slug: string }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${slug}/clients`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load clients');
        return;
      }
      setClients(data.clients ?? []);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function setStatus(c: Client, next: 'approved' | 'suspended') {
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/${slug}/clients/${c.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? 'Failed to update status');
        return;
      }
      setClients(prev => prev.map(r => (r.id === c.id ? { ...r, status: next } : r)));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading clients…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-zinc-900">Clients</h2>

      <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Joined</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {clients.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-zinc-500 text-sm">
                  No clients yet.
                </td>
              </tr>
            ) : (
              clients.map(c => {
                const busy = busyId === c.id;
                return (
                  <tr key={c.id} className="hover:bg-zinc-50">
                    <td className="px-3 py-3 text-zinc-900">{c.display_name}</td>
                    <td className="px-3 py-3 text-zinc-700">{c.email}</td>
                    <td className="px-3 py-3 text-zinc-700">{c.phone ?? '—'}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded border ${
                          CLIENT_STATUS_COLORS[c.status] ?? CLIENT_STATUS_COLORS.unverified
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[11px] text-zinc-500">
                      {formatDate(c.created_at)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {c.status !== 'approved' && (
                          <button
                            type="button"
                            onClick={() => setStatus(c, 'approved')}
                            disabled={busy}
                            className="text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:opacity-50"
                          >
                            Approve
                          </button>
                        )}
                        {c.status !== 'suspended' && (
                          <button
                            type="button"
                            onClick={() => setStatus(c, 'suspended')}
                            disabled={busy}
                            className="text-xs px-2 py-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 rounded disabled:opacity-50"
                          >
                            Suspend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
