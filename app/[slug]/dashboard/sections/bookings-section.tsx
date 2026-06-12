'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTenantConfig } from '@/lib/context/tenant-config';
import Badge, { type BadgeVariant } from '@/components/ui/badge';
import Spinner from '@/components/ui/spinner';
import EmptyState from '@/components/ui/empty-state';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import AddToCalendar from '@/components/add-to-calendar';
import type { CalendarEvent } from '@/lib/calendar/buildUrl';
import CreateBookingModal from './create-booking-modal';
import BookingDetailPanel, { type BookingDetail } from './booking-detail-panel';
import BookingsCalendar from './bookings-calendar';

interface JoinObj {
  pseudonym?: string;
  display_name?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  wa_opt_in?: boolean | null;
}

interface Booking extends BookingDetail {
  created_at: string;
  staff: JoinObj | JoinObj[] | null;
  clients: JoinObj | JoinObj[] | null;
  guest_clients: JoinObj | JoinObj[] | null;
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

function calendarEventOf(b: Booking, bookingLabel: string): CalendarEvent {
  const tags = b.booking_service_tags.map(t => t.tag_name).join(', ');
  return {
    title: `${bookingLabel} with ${clientNameOf(b)}`,
    date: b.slot_date,
    startTime: b.slot_start,
    endTime: b.slot_end,
    ...(tags ? { description: `Services: ${tags}` } : {}),
  };
}

function isActionable(b: Booking): boolean {
  const now = new Date();
  const endDateTime = new Date(`${b.slot_date}T${b.slot_end}`);
  return b.status === 'confirmed' && endDateTime < now;
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

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  pending_staff: 'warning',
  confirmed: 'success',
  cancelled: 'default',
  completed: 'info',
  no_show: 'danger',
};

const tableWrap = 'border border-border rounded-lg overflow-hidden bg-surface';
const theadCls = 'bg-elevated border-b border-border';
const thCls = 'text-left text-[11px] font-medium uppercase tracking-wider text-fg-muted';

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? 'default'}>{status.replace('_', ' ')}</Badge>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function DetailsToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={open ? 'Hide details' : 'See details'}
      aria-label={open ? 'Hide details' : 'See details'}
      aria-expanded={open}
      className="p-1 text-fg-muted hover:text-fg rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={`transition-transform ${open ? 'rotate-90' : ''}`}
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

export default function BookingsSection({ slug }: { slug: string }) {
  const { terminology } = useTenantConfig();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<Record<string, 'idle' | 'busy'>>({});
  const [declineMode, setDeclineMode] = useState<Record<string, string>>({});
  const [assignChoice, setAssignChoice] = useState<Record<string, string>>({});
  const [staffOptions, setStaffOptions] = useState<Array<{ id: string; pseudonym: string }>>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmNoShowId, setConfirmNoShowId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currency, setCurrency] = useState('EUR');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  // Currency for the detail panel's price breakdown.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/${slug}/settings/summary`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data?.settings?.currency) setCurrency(data.settings.currency);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  function toggleExpanded(id: string) {
    setExpandedId(prev => (prev === id ? null : id));
  }

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

  // Staff options for assigning unassigned (pool) bookings.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/${slug}/staff`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        const active = (data.staff ?? []).filter(
          (s: { status: string }) => s.status === 'active'
        );
        setStaffOptions(active.map((s: { id: string; pseudonym: string }) => ({ id: s.id, pseudonym: s.pseudonym })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function handleAssign(id: string) {
    const staffId = assignChoice[id];
    if (!staffId) return;
    setActionState(prev => ({ ...prev, [id]: 'busy' }));
    try {
      const res = await fetch(`/api/${slug}/bookings/${id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Couldn't assign. Please try again.");
        return;
      }
      toast.success(`${terminology.booking} assigned.`);
      setAssignChoice(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await reload();
    } finally {
      setActionState(prev => ({ ...prev, [id]: 'idle' }));
    }
  }

  async function handleAccept(id: string) {
    setActionState(prev => ({ ...prev, [id]: 'busy' }));
    try {
      const res = await fetch(`/api/${slug}/bookings/${id}/accept`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Couldn't accept. Please try again.");
        return;
      }
      toast.success(`${terminology.booking} confirmed.`);
      await reload();
    } finally {
      setActionState(prev => ({ ...prev, [id]: 'idle' }));
    }
  }

  async function handleStatus(id: string, status: 'completed' | 'no_show') {
    setActionState(prev => ({ ...prev, [id]: 'busy' }));
    try {
      const res = await fetch(`/api/${slug}/bookings/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Couldn't update. Please try again.");
        return;
      }
      toast.success(status === 'completed' ? 'Marked completed.' : 'Marked as no-show.');
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
        toast.error(data.error ?? "Couldn't decline. Please try again.");
        return;
      }
      toast.success(`${terminology.booking} declined.`);
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
    return (
      <div className="flex justify-center py-16 text-fg-muted">
        <Spinner size="lg" />
      </div>
    );
  }
  if (error) {
    return <p className="text-sm text-red-500">{error}</p>;
  }

  if (bookings.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-sm font-semibold text-fg">{terminology.booking_plural}</h2>
        <EmptyState
          icon={<CalendarIcon />}
          title={`No ${terminology.booking_plural.toLowerCase()} yet`}
          description={`Once ${terminology.client_plural.toLowerCase()} start booking, everything shows up here. You can also create one manually.`}
          actionLabel={`Create a ${terminology.booking.toLowerCase()}`}
          onAction={() => setShowCreate(true)}
        />
        {showCreate && (
          <CreateBookingModal
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">{terminology.booking_plural}</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded border border-border overflow-hidden">
            {(['list', 'calendar'] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setViewMode(v)}
                aria-pressed={viewMode === v}
                className={`text-xs px-3 py-1.5 capitalize transition-colors ${
                  viewMode === v ? 'bg-fg text-canvas' : 'bg-surface text-fg-muted hover:bg-elevated'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <a
            href={`/api/${slug}/export/bookings`}
            download
            className="text-xs px-3 py-1.5 border border-border text-fg rounded hover:bg-elevated transition-colors"
          >
            Export CSV
          </a>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="text-xs px-3 py-1.5 bg-fg text-canvas rounded hover:opacity-90 transition-opacity"
          >
            + New {terminology.booking}
          </button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <BookingsCalendar bookings={bookings} currency={currency} />
      ) : (
      <>
      {/* Pending */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-fg">Pending requests</h2>
          {pending.length > 0 && (
            <span className="bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30 text-[11px] font-medium px-2 py-0.5 rounded-full">
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <p className="text-sm text-fg-muted">No pending requests.</p>
        ) : (
          <div className={tableWrap}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead className={theadCls}>
                  <tr className={thCls}>
                    <th className="px-3 py-2 w-8"><span className="sr-only">Details</span></th>
                    <th className="px-3 py-2">Ref</th>
                    <th className="px-3 py-2">{terminology.staff}</th>
                    <th className="px-3 py-2">{terminology.client}</th>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Tags</th>
                    <th className="px-3 py-2">Requested</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pending.map(b => {
                    const busy = actionState[b.id] === 'busy';
                    const inDecline = b.id in declineMode;
                    return (
                      <Fragment key={b.id}>
                      <tr className="hover:bg-elevated">
                        <td className="px-3 py-3">
                          <DetailsToggle open={expandedId === b.id} onToggle={() => toggleExpanded(b.id)} />
                        </td>
                        <td className="px-3 py-3 font-mono text-[11px] text-fg-muted">
                          {b.id.slice(0, 8)}
                        </td>
                        <td className="px-3 py-3 text-fg">{staffNameOf(b)}</td>
                        <td className="px-3 py-3 text-fg">
                          {clientNameOf(b)}
                          {b.source === 'manual' && (
                            <span className="text-[10px] text-fg-subtle ml-1">Manual</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-fg-muted whitespace-nowrap">
                          {formatDate(b.slot_date)} · {b.slot_start.slice(0, 5)}–{b.slot_end.slice(0, 5)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {b.booking_service_tags.slice(0, 3).map(t => (
                              <span
                                key={t.tag_name}
                                className="bg-elevated text-fg-muted text-[10px] px-1.5 py-0.5 rounded border border-border"
                              >
                                {t.tag_name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-[11px] text-fg-muted whitespace-nowrap">
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
                                className="text-xs bg-elevated border border-border rounded px-2 py-1 w-36 text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              />
                              <button
                                type="button"
                                onClick={() => handleDecline(b.id)}
                                disabled={busy}
                                className="text-xs px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded disabled:opacity-50"
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
                                className="text-xs px-2 py-1 text-fg-muted hover:bg-elevated rounded"
                              >
                                ✕
                              </button>
                            </div>
                          ) : !pickOne(b.staff) ? (
                            <div className="flex justify-end items-center gap-1">
                              <select
                                value={assignChoice[b.id] ?? ''}
                                onChange={e =>
                                  setAssignChoice(prev => ({ ...prev, [b.id]: e.target.value }))
                                }
                                className="text-xs bg-elevated border border-border rounded px-2 py-1 text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <option value="">Assign to…</option>
                                {staffOptions.map(s => (
                                  <option key={s.id} value={s.id}>
                                    {s.pseudonym}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleAssign(b.id)}
                                disabled={busy || !assignChoice[b.id]}
                                className="text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
                              >
                                Assign
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeclineMode(prev => ({ ...prev, [b.id]: '' }))
                                }
                                disabled={busy}
                                className="text-xs px-2 py-1 bg-elevated hover:bg-sunken text-fg rounded disabled:opacity-50"
                              >
                                Decline
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleAccept(b.id)}
                                disabled={busy}
                                className="text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeclineMode(prev => ({ ...prev, [b.id]: '' }))
                                }
                                disabled={busy}
                                className="text-xs px-2 py-1 bg-elevated hover:bg-sunken text-fg rounded disabled:opacity-50"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {expandedId === b.id && (
                        <tr>
                          <td colSpan={8} className="p-0">
                            <BookingDetailPanel booking={b} currency={currency} />
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Upcoming */}
      <section>
        <h2 className="text-sm font-semibold text-fg mb-3">Upcoming (next 14 days)</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-fg-muted">No upcoming {terminology.booking_plural.toLowerCase()}.</p>
        ) : (
          <div className={tableWrap}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[680px]">
                <thead className={theadCls}>
                  <tr className={thCls}>
                    <th className="px-3 py-2 w-8"><span className="sr-only">Details</span></th>
                    <th className="px-3 py-2">{terminology.staff}</th>
                    <th className="px-3 py-2">{terminology.client}</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {upcoming.map(b => {
                    const busy = actionState[b.id] === 'busy';
                    return (
                    <Fragment key={b.id}>
                    <tr className="hover:bg-elevated">
                      <td className="px-3 py-3">
                        <DetailsToggle open={expandedId === b.id} onToggle={() => toggleExpanded(b.id)} />
                      </td>
                      <td className="px-3 py-3 text-fg">{staffNameOf(b)}</td>
                      <td className="px-3 py-3 text-fg">
                        {clientNameOf(b)}
                        {b.source === 'manual' && (
                          <span className="text-[10px] text-fg-subtle ml-1">Manual</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-fg-muted whitespace-nowrap">{formatDate(b.slot_date)}</td>
                      <td className="px-3 py-3 text-fg-muted whitespace-nowrap">
                        {b.slot_start.slice(0, 5)}–{b.slot_end.slice(0, 5)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {isActionable(b) && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStatus(b.id, 'completed')}
                                disabled={busy}
                                className="text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
                              >
                                Mark completed
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmNoShowId(b.id)}
                                disabled={busy}
                                className="text-xs px-2 py-1 bg-elevated hover:bg-sunken text-fg-muted rounded disabled:opacity-50"
                              >
                                Mark as no-show
                              </button>
                            </>
                          )}
                          <AddToCalendar event={calendarEventOf(b, terminology.booking)} uid={b.id} />
                        </div>
                      </td>
                    </tr>
                    {expandedId === b.id && (
                      <tr>
                        <td colSpan={6} className="p-0">
                          <BookingDetailPanel booking={b} currency={currency} />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Past */}
      <section>
        <h2 className="text-sm font-semibold text-fg mb-3">Past (last 30)</h2>
        {past.length === 0 ? (
          <p className="text-sm text-fg-muted">No past {terminology.booking_plural.toLowerCase()}.</p>
        ) : (
          <div className={tableWrap}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className={theadCls}>
                  <tr className={thCls}>
                    <th className="px-3 py-2 w-8"><span className="sr-only">Details</span></th>
                    <th className="px-3 py-2">{terminology.staff}</th>
                    <th className="px-3 py-2">{terminology.client}</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {past.map(b => (
                    <Fragment key={b.id}>
                    <tr className="hover:bg-elevated">
                      <td className="px-3 py-3">
                        <DetailsToggle open={expandedId === b.id} onToggle={() => toggleExpanded(b.id)} />
                      </td>
                      <td className="px-3 py-3 text-fg">{staffNameOf(b)}</td>
                      <td className="px-3 py-3 text-fg">
                        {clientNameOf(b)}
                        {b.source === 'manual' && (
                          <span className="text-[10px] text-fg-subtle ml-1">Manual</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-fg-muted whitespace-nowrap">{formatDate(b.slot_date)}</td>
                      <td className="px-3 py-3">
                        <StatusBadge status={b.status} />
                      </td>
                    </tr>
                    {expandedId === b.id && (
                      <tr>
                        <td colSpan={5} className="p-0">
                          <BookingDetailPanel booking={b} currency={currency} />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
      </>
      )}

      {showCreate && (
        <CreateBookingModal
          slug={slug}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            reload();
          }}
        />
      )}

      {confirmNoShowId && (
        <ConfirmDialog
          title="Mark as no-show?"
          description={`The ${terminology.client.toLowerCase()} will be recorded as not having shown up. This affects revenue reporting.`}
          confirmLabel="Mark as no-show"
          onConfirm={async () => {
            await handleStatus(confirmNoShowId, 'no_show');
            setConfirmNoShowId(null);
          }}
          onClose={() => setConfirmNoShowId(null)}
        />
      )}
    </div>
  );
}
