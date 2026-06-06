'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTenantConfig } from '@/lib/context/tenant-config';

interface JoinObj {
  pseudonym?: string;
  display_name?: string;
  name?: string;
}

interface Booking {
  id: string;
  slot_date: string;
  slot_start: string;
  slot_end: string;
  duration_minutes: number;
  status: string;
  created_at: string;
  staff: JoinObj | JoinObj[] | null;
  clients: JoinObj | JoinObj[] | null;
  guest_clients: JoinObj | JoinObj[] | null;
  booking_service_tags: Array<{ tag_name: string }>;
}

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function clientNameOf(b: Booking): string {
  return (
    pickOne(b.clients)?.display_name ??
    pickOne(b.guest_clients)?.name ??
    'Unknown'
  );
}

function staffNameOf(b: Booking): string {
  return pickOne(b.staff)?.pseudonym ?? '—';
}

function formatDate(s: string) {
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STATUS_COLORS: Record<string, string> = {
  pending_staff: 'bg-amber-100 text-amber-800 border-amber-200',
  confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelled: 'bg-zinc-200 text-zinc-700 border-zinc-300',
  completed: 'bg-blue-100 text-blue-800 border-blue-200',
  no_show: 'bg-red-100 text-red-800 border-red-200',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-zinc-200 text-zinc-700 border-zinc-300';
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded border ${cls}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

export default function BookingsSection({ slug }: { slug: string }) {
  const { terminology } = useTenantConfig();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<Record<string, 'idle' | 'busy'>>({});
  const [declineMode, setDeclineMode] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${slug}/bookings?status=all`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load bookings');
        return;
      }
      setBookings(data.bookings ?? []);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleAccept(id: string) {
    setActionState(prev => ({ ...prev, [id]: 'busy' }));
    try {
      const res = await fetch(`/api/${slug}/bookings/${id}/accept`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? 'Failed to accept');
        return;
      }
      await reload();
    } finally {
      setActionState(prev => ({ ...prev, [id]: 'idle' }));
    }
  }

  async function handleDecline(id: string) {
    const reason = declineMode[id] ?? '';
    setActionState(prev => ({ ...prev, [id]: 'busy' }));
    try {
      const res = await fetch(`/api/${slug}/bookings/${id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? 'Failed to decline');
        return;
      }
      setDeclineMode(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await reload();
    } finally {
      setActionState(prev => ({ ...prev, [id]: 'idle' }));
    }
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const horizon = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

  const pending = bookings.filter(b => b.status === 'pending_staff');
  const upcoming = bookings.filter(
    b => b.status === 'confirmed' && b.slot_date >= todayStr && b.slot_date <= horizon
  );
  const past = bookings
    .filter(b => b.slot_date < todayStr || ['cancelled', 'completed', 'no_show'].includes(b.status))
    .slice(0, 30);

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading {terminology.booking_plural.toLowerCase()}…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="space-y-8">
      {/* Pending */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-zinc-900">Pending requests</h2>
          {pending.length > 0 && (
            <span className="bg-amber-100 text-amber-800 text-[11px] font-medium px-2 py-0.5 rounded-full border border-amber-200">
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <p className="text-sm text-zinc-500">No pending requests.</p>
        ) : (
          <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  <th className="px-3 py-2">Ref</th>
                  <th className="px-3 py-2">{terminology.staff}</th>
                  <th className="px-3 py-2">{terminology.client}</th>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Tags</th>
                  <th className="px-3 py-2">Requested</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {pending.map(b => {
                  const busy = actionState[b.id] === 'busy';
                  const inDecline = b.id in declineMode;
                  return (
                    <tr key={b.id} className="hover:bg-zinc-50">
                      <td className="px-3 py-3 font-mono text-[11px] text-zinc-500">
                        {b.id.slice(0, 8)}
                      </td>
                      <td className="px-3 py-3 text-zinc-900">{staffNameOf(b)}</td>
                      <td className="px-3 py-3 text-zinc-900">{clientNameOf(b)}</td>
                      <td className="px-3 py-3 text-zinc-700">
                        {formatDate(b.slot_date)} · {b.slot_start.slice(0, 5)}–{b.slot_end.slice(0, 5)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {b.booking_service_tags.slice(0, 3).map(t => (
                            <span
                              key={t.tag_name}
                              className="bg-zinc-100 text-zinc-700 text-[10px] px-1.5 py-0.5 rounded border border-zinc-200"
                            >
                              {t.tag_name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[11px] text-zinc-500">
                        {formatRelative(b.created_at)}
                      </td>
                      <td className="px-3 py-3">
                        {inDecline ? (
                          <div className="flex justify-end gap-1">
                            <input
                              type="text"
                              autoFocus
                              value={declineMode[b.id]}
                              onChange={e =>
                                setDeclineMode(prev => ({ ...prev, [b.id]: e.target.value }))
                              }
                              placeholder="Reason (optional)"
                              className="text-xs border border-zinc-300 rounded px-2 py-1 w-36"
                            />
                            <button
                              type="button"
                              onClick={() => handleDecline(b.id)}
                              disabled={busy}
                              className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeclineMode(prev => {
                                  const n = { ...prev };
                                  delete n[b.id];
                                  return n;
                                })
                              }
                              className="text-xs px-2 py-1 text-zinc-600 hover:bg-zinc-100 rounded"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleAccept(b.id)}
                              disabled={busy}
                              className="text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:opacity-50"
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeclineMode(prev => ({ ...prev, [b.id]: '' }))
                              }
                              disabled={busy}
                              className="text-xs px-2 py-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 rounded disabled:opacity-50"
                            >
                              Decline
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Upcoming */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">Upcoming (next 14 days)</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-zinc-500">No upcoming {terminology.booking_plural.toLowerCase()}.</p>
        ) : (
          <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  <th className="px-3 py-2">{terminology.staff}</th>
                  <th className="px-3 py-2">{terminology.client}</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {upcoming.map(b => (
                  <tr key={b.id} className="hover:bg-zinc-50">
                    <td className="px-3 py-3 text-zinc-900">{staffNameOf(b)}</td>
                    <td className="px-3 py-3 text-zinc-900">{clientNameOf(b)}</td>
                    <td className="px-3 py-3 text-zinc-700">{formatDate(b.slot_date)}</td>
                    <td className="px-3 py-3 text-zinc-700">
                      {b.slot_start.slice(0, 5)}–{b.slot_end.slice(0, 5)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Past */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">Past (last 30)</h2>
        {past.length === 0 ? (
          <p className="text-sm text-zinc-500">No past {terminology.booking_plural.toLowerCase()}.</p>
        ) : (
          <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  <th className="px-3 py-2">{terminology.staff}</th>
                  <th className="px-3 py-2">{terminology.client}</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {past.map(b => (
                  <tr key={b.id} className="hover:bg-zinc-50">
                    <td className="px-3 py-3 text-zinc-900">{staffNameOf(b)}</td>
                    <td className="px-3 py-3 text-zinc-900">{clientNameOf(b)}</td>
                    <td className="px-3 py-3 text-zinc-700">{formatDate(b.slot_date)}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
