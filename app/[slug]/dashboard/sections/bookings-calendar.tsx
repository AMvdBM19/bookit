'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useTenantConfig } from '@/lib/context/tenant-config';
import Modal from '@/components/ui/modal';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import BookingDetailPanel, { type BookingDetail } from './booking-detail-panel';

/**
 * Read-only calendar view for the Bookings tab (week + day). Plain CSS grid,
 * no library. Blocks are colored by status; pool/unassigned bookings render
 * with a dashed outline. Clicking a block opens the shared detail panel.
 * No drag-to-reschedule — that is a future sprint.
 */

const DAY_MS = 86400000;
const HOUR_PX = 48;

const STATUS_BLOCK_COLORS: Record<string, string> = {
  pending_staff:
    'bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-500/20 dark:border-amber-500/50 dark:text-amber-200',
  confirmed:
    'bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-500/20 dark:border-emerald-500/50 dark:text-emerald-200',
  completed:
    'bg-sky-100 border-sky-300 text-sky-900 dark:bg-sky-500/20 dark:border-sky-500/50 dark:text-sky-200',
  cancelled:
    'bg-zinc-100 border-zinc-300 text-zinc-500 line-through dark:bg-zinc-500/15 dark:border-zinc-500/40 dark:text-zinc-400',
  no_show:
    'bg-red-100 border-red-300 text-red-900 dark:bg-red-500/20 dark:border-red-500/50 dark:text-red-200',
};

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function toDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mondayOf(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
}

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

interface StaffAvailability {
  schedule: Array<{ day_of_week: number; start_time: string; end_time: string }>;
  exceptions: Array<{ date: string; reason: string | null }>;
}

// B2 — all-staff day summary (per staff: working window, day off, bookings).
interface StaffSummaryEntry {
  id: string;
  pseudonym: string;
  day_off: boolean;
  day_off_reason: string | null;
  working_blocks: Array<{ start: string; end: string }>;
  bookings: Array<{ id: string; start: string; end: string; status: string }>;
}
interface AvailabilitySummary {
  date: string;
  staff: StaffSummaryEntry[];
}

/** Round HH:MM minutes-from-midnight to the nearest 15 and return HH:MM. */
function snapToQuarter(totalMinutes: number): string {
  const snapped = Math.round(totalMinutes / 15) * 15;
  const hh = Math.floor(snapped / 60);
  const mm = snapped % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export default function BookingsCalendar({
  bookings,
  currency,
  slug,
  selectedStaffId = null,
  onEdit,
  onReschedule,
  staffOptions = [],
  onAssign,
  onStatus,
  onCreateAt,
}: {
  bookings: BookingDetail[];
  currency: string;
  slug?: string;
  /** When set, shade each day by this staff member's schedule + days off (A7). */
  selectedStaffId?: string | null;
  onEdit?: (bookingId: string) => void;
  /** Agent-only reschedule action (Phase 20-A3). */
  onReschedule?: (b: BookingDetail) => void;
  staffOptions?: Array<{ id: string; pseudonym: string }>;
  onAssign?: (id: string, staffId: string) => Promise<void>;
  onStatus?: (id: string, target: string, reason?: string) => Promise<boolean>;
  /** Click an empty available cell in the All-staff view → prefill manual booking (B2). */
  onCreateAt?: (init: { staffId: string; date: string; start: string }) => void;
}) {
  const { terminology } = useTenantConfig();
  const [view, setView] = useState<'week' | 'day'>('week');
  const [anchor, setAnchor] = useState(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  });
  const [openBooking, setOpenBooking] = useState<BookingDetail | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; booking: BookingDetail } | null>(null);
  const [cancelBooking, setCancelBooking] = useState<BookingDetail | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A7 — staff availability overlay. Cached per staffId for the session.
  const [availability, setAvailability] = useState<StaffAvailability | null>(null);
  const availabilityCache = useRef<Record<string, StaffAvailability>>({});

  useEffect(() => {
    if (!selectedStaffId || !slug) {
      setAvailability(null);
      return;
    }
    const cached = availabilityCache.current[selectedStaffId];
    if (cached) {
      setAvailability(cached);
      return;
    }
    let cancelled = false;
    fetch(`/api/${slug}/staff/${selectedStaffId}/availability`)
      .then(res => (res.ok ? res.json() : null))
      .then((data: StaffAvailability | null) => {
        if (cancelled || !data) return;
        availabilityCache.current[selectedStaffId] = data;
        setAvailability(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedStaffId, slug]);

  // B2 — all-staff day view. Toggle, plus a per-date summary cached for session.
  const [staffViewMode, setStaffViewMode] = useState<'single' | 'all'>('single');
  const [summary, setSummary] = useState<AvailabilitySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const summaryCache = useRef<Record<string, AvailabilitySummary>>({});

  useEffect(() => {
    if (staffViewMode !== 'all' || !slug) return;
    const ds = toDateStr(anchor);
    const cached = summaryCache.current[ds];
    if (cached) {
      setSummary(cached);
      return;
    }
    let cancelled = false;
    setSummaryLoading(true);
    fetch(`/api/${slug}/staff/availability-summary?date=${ds}`)
      .then(res => (res.ok ? res.json() : null))
      .then((data: AvailabilitySummary | null) => {
        if (cancelled || !data) return;
        summaryCache.current[ds] = data;
        setSummary(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [staffViewMode, slug, anchor]);

  const quickActionsEnabled = !!onStatus;

  function openMenu(e: React.MouseEvent, b: BookingDetail) {
    if (!quickActionsEnabled) return;
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, booking: b });
  }

  // Dismiss the context menu on any outside click / Escape.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const days: Date[] =
    view === 'week'
      ? Array.from({ length: 7 }, (_, i) => new Date(mondayOf(anchor).getTime() + i * DAY_MS))
      : [anchor];

  const dayStrs = days.map(toDateStr);

  const byDay = useMemo(() => {
    const map: Record<string, BookingDetail[]> = {};
    for (const b of bookings) {
      (map[b.slot_date] ??= []).push(b);
    }
    return map;
  }, [bookings]);

  // Hour range: fit the visible bookings, with a sensible default window.
  let startHour = 8;
  let endHour = 20;
  for (const ds of dayStrs) {
    for (const b of byDay[ds] ?? []) {
      startHour = Math.min(startHour, Math.floor(minutesOf(b.slot_start) / 60));
      endHour = Math.max(endHour, Math.ceil(minutesOf(b.slot_end) / 60));
    }
  }
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const columnHeight = (endHour - startHour) * HOUR_PX;

  function shift(deltaDays: number) {
    setAnchor(prev => new Date(prev.getTime() + deltaDays * DAY_MS));
  }

  const todayStr = toDateStr(new Date());
  const allStaff = staffViewMode === 'all';
  const rangeLabel =
    allStaff || view === 'day'
      ? anchor.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : `${days[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const navStep = allStaff || view === 'day' ? 1 : 7;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shift(-navStep)}
            aria-label="Previous"
            className="text-xs px-2 py-1 bg-elevated hover:bg-sunken text-fg rounded"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => {
              const t = new Date();
              t.setHours(0, 0, 0, 0);
              setAnchor(t);
            }}
            className="text-xs px-2 py-1 bg-elevated hover:bg-sunken text-fg rounded"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => shift(navStep)}
            aria-label="Next"
            className="text-xs px-2 py-1 bg-elevated hover:bg-sunken text-fg rounded"
          >
            ›
          </button>
          <span className="text-sm text-fg font-medium ml-2">{rangeLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Single-staff (week/day) ⇄ All-staff (day) */}
          <div className="flex items-center rounded border border-border overflow-hidden">
            {([['single', 'Single staff'], ['all', 'All staff']] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setStaffViewMode(mode)}
                aria-pressed={staffViewMode === mode}
                className={`text-xs px-3 py-1.5 transition-colors ${
                  staffViewMode === mode ? 'bg-fg text-canvas' : 'bg-surface text-fg-muted hover:bg-elevated'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {!allStaff && (
            <div className="flex items-center rounded border border-border overflow-hidden">
              {(['week', 'day'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`text-xs px-3 py-1.5 capitalize transition-colors ${
                    view === v ? 'bg-fg text-canvas' : 'bg-surface text-fg-muted hover:bg-elevated'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {allStaff && (
        <AllStaffDay
          summary={summary}
          loading={summaryLoading}
          dateStr={toDateStr(anchor)}
          isToday={toDateStr(anchor) === todayStr}
          onOpenBooking={id => {
            const b = bookings.find(x => x.id === id);
            if (b) setOpenBooking(b);
          }}
          onCreateAt={onCreateAt}
        />
      )}

      {!allStaff && (
      <div className="border border-border rounded-lg overflow-hidden bg-surface">
        <div className="overflow-x-auto">
          <div className={view === 'week' ? 'min-w-[840px]' : 'min-w-[360px]'}>
            {/* Day headers */}
            <div
              className="grid border-b border-border bg-elevated"
              style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}
            >
              <div />
              {days.map((d, i) => (
                <div
                  key={dayStrs[i]}
                  className={`px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wider border-l border-border ${
                    dayStrs[i] === todayStr ? 'text-fg' : 'text-fg-muted'
                  }`}
                >
                  {d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}
                  {dayStrs[i] === todayStr && (
                    <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 align-middle" />
                  )}
                </div>
              ))}
            </div>

            {/* Grid body */}
            <div
              className="grid"
              style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}
            >
              {/* Hour gutter */}
              <div className="relative" style={{ height: columnHeight }}>
                {hours.map(h => (
                  <span
                    key={h}
                    className="absolute right-1.5 -translate-y-1/2 text-[10px] text-fg-subtle"
                    style={{ top: (h - startHour) * HOUR_PX }}
                  >
                    {h > 0 ? `${String(h).padStart(2, '0')}:00` : ''}
                  </span>
                ))}
              </div>

              {dayStrs.map(ds => (
                <div
                  key={ds}
                  className="relative border-l border-border"
                  style={{ height: columnHeight }}
                >
                  {/* A7 — staff availability overlay (shading + days off) */}
                  {availability && (() => {
                    const dow = new Date(ds + 'T00:00:00').getDay();
                    const exception = availability.exceptions.find(e => e.date === ds);
                    if (exception) {
                      return (
                        <div
                          className="absolute inset-0 bg-red-500/10 pointer-events-none"
                          title={exception.reason ?? 'Day off'}
                        >
                          <span className="absolute top-1 left-1 text-[9px] font-medium uppercase tracking-wider text-red-600 dark:text-red-300">
                            Day off
                          </span>
                        </div>
                      );
                    }
                    const blocks = availability.schedule.filter(s => s.day_of_week === dow);
                    return (
                      <>
                        {/* Out-of-schedule hatch */}
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            backgroundImage:
                              'repeating-linear-gradient(45deg, rgba(120,120,120,0.10) 0, rgba(120,120,120,0.10) 5px, transparent 5px, transparent 11px)',
                          }}
                        />
                        {/* Working-hours bands cut through the hatch */}
                        {blocks.map((blk, i) => {
                          const s = Math.max(minutesOf(blk.start_time), startHour * 60);
                          const e = Math.min(minutesOf(blk.end_time), endHour * 60);
                          if (e <= s) return null;
                          return (
                            <div
                              key={i}
                              className="absolute inset-x-0 bg-surface pointer-events-none"
                              style={{ top: ((s - startHour * 60) / 60) * HOUR_PX, height: ((e - s) / 60) * HOUR_PX }}
                            />
                          );
                        })}
                      </>
                    );
                  })()}

                  {hours.map(h => (
                    <div
                      key={h}
                      className="absolute inset-x-0 border-t border-border/60"
                      style={{ top: (h - startHour) * HOUR_PX }}
                    />
                  ))}

                  {(byDay[ds] ?? []).map(b => {
                    const top = ((minutesOf(b.slot_start) - startHour * 60) / 60) * HOUR_PX;
                    const height = Math.max(
                      20,
                      ((minutesOf(b.slot_end) - minutesOf(b.slot_start)) / 60) * HOUR_PX
                    );
                    const staff = pickOne(b.staff);
                    const client =
                      pickOne(b.clients)?.display_name ?? pickOne(b.guest_clients)?.name ?? 'Unknown';
                    const isPool = !staff;
                    const colors = STATUS_BLOCK_COLORS[b.status] ?? STATUS_BLOCK_COLORS.confirmed;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setOpenBooking(b)}
                        onContextMenu={e => openMenu(e, b)}
                        onTouchStart={e => {
                          if (!quickActionsEnabled) return;
                          const touch = e.touches[0];
                          const x = touch.clientX;
                          const y = touch.clientY;
                          longPressTimer.current = setTimeout(
                            () => setMenu({ x, y, booking: b }),
                            500
                          );
                        }}
                        onTouchEnd={() => {
                          if (longPressTimer.current) clearTimeout(longPressTimer.current);
                        }}
                        onTouchMove={() => {
                          if (longPressTimer.current) clearTimeout(longPressTimer.current);
                        }}
                        title={`${b.slot_start.slice(0, 5)}–${b.slot_end.slice(0, 5)} ${client}`}
                        className={`absolute inset-x-0.5 rounded border px-1.5 py-0.5 text-left text-[10px] leading-tight overflow-hidden transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${colors} ${
                          isPool ? 'border-dashed' : ''
                        }`}
                        style={{ top, height }}
                      >
                        <span className="font-medium block truncate">
                          {b.slot_start.slice(0, 5)} {client}
                        </span>
                        <span className="block truncate opacity-80">
                          {staff?.pseudonym ?? `Pool — unassigned`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-[10px] text-fg-muted">
        {Object.entries({
          pending_staff: 'Pending',
          confirmed: 'Confirmed',
          completed: 'Completed',
          cancelled: 'Cancelled',
          no_show: 'No-show',
        }).map(([status, label]) => (
          <span key={status} className="inline-flex items-center gap-1">
            <span className={`inline-block w-2.5 h-2.5 rounded-sm border ${STATUS_BLOCK_COLORS[status]}`} />
            {label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm border border-dashed border-border-strong" />
          Pool / unassigned
        </span>
        {availability && (
          <>
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm border border-border-strong"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(45deg, rgba(120,120,120,0.3) 0, rgba(120,120,120,0.3) 2px, transparent 2px, transparent 4px)',
                }}
              />
              Out of schedule
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500/20 border border-red-300" />
              Day off
            </span>
          </>
        )}
      </div>

      {openBooking && (
        <Modal
          title={`${terminology.booking} details`}
          onClose={() => setOpenBooking(null)}
          maxWidth="max-w-2xl"
        >
          <BookingDetailPanel
            booking={openBooking}
            currency={currency}
            slug={slug}
            onEdit={
              onEdit
                ? id => {
                    setOpenBooking(null);
                    onEdit(id);
                  }
                : undefined
            }
            onReschedule={
              onReschedule
                ? bk => {
                    setOpenBooking(null);
                    onReschedule(bk);
                  }
                : undefined
            }
          />
        </Modal>
      )}

      {menu && (() => {
        const b = menu.booking;
        const staff = pickOne(b.staff);
        const isPool = !staff && b.status === 'pending_staff';
        const ended = new Date(`${b.slot_date}T${b.slot_end}`) < new Date();
        const editable = ['pending_staff', 'confirmed', 'completed'].includes(b.status);
        const reschedulable = ['pending_staff', 'confirmed'].includes(b.status);
        const item = 'block w-full text-left px-3 py-1.5 text-xs text-fg hover:bg-elevated';
        return (
          <div
            className="fixed z-50 min-w-[160px] rounded-lg border border-border bg-surface shadow-lg py-1"
            style={{ top: Math.min(menu.y, window.innerHeight - 240), left: Math.min(menu.x, window.innerWidth - 180) }}
            onClick={e => e.stopPropagation()}
          >
            {isPool && staffOptions.length > 0 && onAssign && (
              <div className="px-3 py-1.5 border-b border-border">
                <select
                  defaultValue=""
                  onChange={async e => {
                    if (e.target.value) {
                      await onAssign(b.id, e.target.value);
                      setMenu(null);
                    }
                  }}
                  className="w-full text-xs bg-elevated text-fg border border-border rounded px-1 py-1"
                  aria-label="Assign staff"
                >
                  <option value="">Assign…</option>
                  {staffOptions.map(s => (
                    <option key={s.id} value={s.id}>{s.pseudonym}</option>
                  ))}
                </select>
              </div>
            )}
            {b.status === 'confirmed' && (
              <>
                <button
                  type="button"
                  className={item}
                  onClick={async () => {
                    setMenu(null);
                    if (!ended) { toast.error("Booking hasn't ended yet."); return; }
                    await onStatus?.(b.id, 'completed');
                  }}
                >
                  Mark completed
                </button>
                <button
                  type="button"
                  className={item}
                  onClick={async () => {
                    setMenu(null);
                    if (!ended) { toast.error("Booking hasn't ended yet."); return; }
                    await onStatus?.(b.id, 'no_show');
                  }}
                >
                  Mark no-show
                </button>
              </>
            )}
            {(b.status === 'pending_staff' || b.status === 'confirmed') && (
              <button
                type="button"
                className={item}
                onClick={() => {
                  setMenu(null);
                  setCancelReason('');
                  setCancelBooking(b);
                }}
              >
                Cancel
              </button>
            )}
            {reschedulable && onReschedule && (
              <button
                type="button"
                className={item}
                onClick={() => {
                  setMenu(null);
                  onReschedule(b);
                }}
              >
                Reschedule
              </button>
            )}
            {editable && onEdit && (
              <button
                type="button"
                className={item}
                onClick={() => {
                  setMenu(null);
                  onEdit(b.id);
                }}
              >
                Edit
              </button>
            )}
            <button
              type="button"
              className={item}
              onClick={() => {
                setMenu(null);
                setOpenBooking(b);
              }}
            >
              View details
            </button>
          </div>
        );
      })()}

      {cancelBooking && (
        <ConfirmDialog
          title={`Cancel this ${terminology.booking.toLowerCase()}?`}
          description={
            <div className="space-y-2">
              <p>The {terminology.client.toLowerCase()} will be notified of the cancellation.</p>
              <input
                type="text"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Reason (optional)"
                className="w-full text-sm bg-elevated text-fg border border-border rounded px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          }
          confirmLabel="Cancel booking"
          onConfirm={async () => {
            const b = cancelBooking;
            setCancelBooking(null);
            if (b) await onStatus?.(b.id, 'cancelled', cancelReason || undefined);
          }}
          onClose={() => setCancelBooking(null)}
        />
      )}
    </div>
  );
}

const SUMMARY_BLOCK_COLORS: Record<string, string> = {
  pending_staff:
    'bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-500/20 dark:border-amber-500/50 dark:text-amber-200',
  confirmed:
    'bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-500/20 dark:border-emerald-500/50 dark:text-emerald-200',
};

/**
 * All-staff day view (B2): one column per active {staff} for a single date.
 * Working hours render clear over a hatched out-of-hours background; days off
 * tint the column red; bookings render as positioned blocks. Clicking an empty
 * spot inside a working band prefills the manual-booking modal.
 */
function AllStaffDay({
  summary,
  loading,
  dateStr,
  isToday,
  onOpenBooking,
  onCreateAt,
}: {
  summary: AvailabilitySummary | null;
  loading: boolean;
  dateStr: string;
  isToday: boolean;
  onOpenBooking: (bookingId: string) => void;
  onCreateAt?: (init: { staffId: string; date: string; start: string }) => void;
}) {
  const staff = summary?.staff ?? [];

  // Fit the hour window to the day's schedules + bookings (default 8–20).
  let startHour = 8;
  let endHour = 20;
  for (const s of staff) {
    for (const w of s.working_blocks) {
      startHour = Math.min(startHour, Math.floor(minutesOf(w.start) / 60));
      endHour = Math.max(endHour, Math.ceil(minutesOf(w.end) / 60));
    }
    for (const b of s.bookings) {
      startHour = Math.min(startHour, Math.floor(minutesOf(b.start) / 60));
      endHour = Math.max(endHour, Math.ceil(minutesOf(b.end) / 60));
    }
  }
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const columnHeight = (endHour - startHour) * HOUR_PX;

  function handleColumnClick(e: React.MouseEvent<HTMLDivElement>, s: StaffSummaryEntry) {
    if (!onCreateAt || s.day_off) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const minutes = startHour * 60 + (offsetY / HOUR_PX) * 60;
    const start = snapToQuarter(minutes);
    // Only offer creation inside a working band.
    const inWorking = s.working_blocks.some(w => start >= w.start && start < w.end);
    if (!inWorking) return;
    onCreateAt({ staffId: s.id, date: dateStr, start });
  }

  return (
    <div className="space-y-3">
      <div className="border border-border rounded-lg overflow-hidden bg-surface">
        {loading && !summary ? (
          <p className="text-sm text-fg-muted text-center py-10">Loading availability…</p>
        ) : staff.length === 0 ? (
          <p className="text-sm text-fg-muted text-center py-10">No active staff to show.</p>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${56 + staff.length * 130}px` }}>
              {/* Staff headers */}
              <div
                className="grid border-b border-border bg-elevated"
                style={{ gridTemplateColumns: `56px repeat(${staff.length}, 1fr)` }}
              >
                <div />
                {staff.map(s => (
                  <div
                    key={s.id}
                    className="px-2 py-2 text-center text-[11px] font-medium border-l border-border text-fg truncate"
                    title={s.pseudonym}
                  >
                    {s.pseudonym}
                    {s.day_off && (
                      <span className="block text-[9px] font-normal uppercase tracking-wider text-red-600 dark:text-red-300">
                        Day off
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Body */}
              <div
                className="grid"
                style={{ gridTemplateColumns: `56px repeat(${staff.length}, 1fr)` }}
              >
                {/* Hour gutter */}
                <div className="relative" style={{ height: columnHeight }}>
                  {hours.map(h => (
                    <span
                      key={h}
                      className="absolute right-1.5 -translate-y-1/2 text-[10px] text-fg-subtle"
                      style={{ top: (h - startHour) * HOUR_PX }}
                    >
                      {h > 0 ? `${String(h).padStart(2, '0')}:00` : ''}
                    </span>
                  ))}
                </div>

                {staff.map(s => (
                  <div
                    key={s.id}
                    onClick={e => handleColumnClick(e, s)}
                    className={`relative border-l border-border ${onCreateAt && !s.day_off ? 'cursor-copy' : ''}`}
                    style={{ height: columnHeight }}
                  >
                    {s.day_off ? (
                      <div className="absolute inset-0 bg-red-500/10 pointer-events-none" title={s.day_off_reason ?? 'Day off'} />
                    ) : (
                      <>
                        {/* Out-of-schedule hatch */}
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            backgroundImage:
                              'repeating-linear-gradient(45deg, rgba(120,120,120,0.10) 0, rgba(120,120,120,0.10) 5px, transparent 5px, transparent 11px)',
                          }}
                        />
                        {/* Working bands (clear) */}
                        {s.working_blocks.map((w, i) => {
                          const top = Math.max(((minutesOf(w.start) - startHour * 60) / 60) * HOUR_PX, 0);
                          const bot = Math.min(((minutesOf(w.end) - startHour * 60) / 60) * HOUR_PX, columnHeight);
                          if (bot <= top) return null;
                          return (
                            <div
                              key={i}
                              className="absolute inset-x-0 bg-surface pointer-events-none"
                              style={{ top, height: bot - top }}
                            />
                          );
                        })}
                      </>
                    )}

                    {/* Hour lines */}
                    {hours.map(h => (
                      <div
                        key={h}
                        className="absolute inset-x-0 border-t border-border/60 pointer-events-none"
                        style={{ top: (h - startHour) * HOUR_PX }}
                      />
                    ))}

                    {/* Booking blocks */}
                    {s.bookings.map(b => {
                      const top = ((minutesOf(b.start) - startHour * 60) / 60) * HOUR_PX;
                      const height = Math.max(18, ((minutesOf(b.end) - minutesOf(b.start)) / 60) * HOUR_PX);
                      const colors = SUMMARY_BLOCK_COLORS[b.status] ?? SUMMARY_BLOCK_COLORS.confirmed;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            onOpenBooking(b.id);
                          }}
                          title={`${b.start}–${b.end}`}
                          className={`absolute inset-x-0.5 rounded border px-1 py-0.5 text-left text-[10px] leading-tight overflow-hidden hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${colors}`}
                          style={{ top, height }}
                        >
                          <span className="font-medium block truncate">{b.start}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <p className="text-[10px] text-fg-muted">
        {isToday ? 'Today · ' : ''}Click an empty spot in a working column to start a manual {''}
        booking at that time.
      </p>
    </div>
  );
}
