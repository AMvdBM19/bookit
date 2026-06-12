'use client';

import { useMemo, useState } from 'react';
import { useTenantConfig } from '@/lib/context/tenant-config';
import Modal from '@/components/ui/modal';
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

export default function BookingsCalendar({
  bookings,
  currency,
  slug,
}: {
  bookings: BookingDetail[];
  currency: string;
  slug?: string;
}) {
  const { terminology } = useTenantConfig();
  const [view, setView] = useState<'week' | 'day'>('week');
  const [anchor, setAnchor] = useState(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  });
  const [openBooking, setOpenBooking] = useState<BookingDetail | null>(null);

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
  const rangeLabel =
    view === 'week'
      ? `${days[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : anchor.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shift(view === 'week' ? -7 : -1)}
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
            onClick={() => shift(view === 'week' ? 7 : 1)}
            aria-label="Next"
            className="text-xs px-2 py-1 bg-elevated hover:bg-sunken text-fg rounded"
          >
            ›
          </button>
          <span className="text-sm text-fg font-medium ml-2">{rangeLabel}</span>
        </div>
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
      </div>

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
      </div>

      {openBooking && (
        <Modal
          title={`${terminology.booking} details`}
          onClose={() => setOpenBooking(null)}
          maxWidth="max-w-2xl"
        >
          <BookingDetailPanel booking={openBooking} currency={currency} slug={slug} />
        </Modal>
      )}
    </div>
  );
}
