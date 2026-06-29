'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTenantConfig } from '@/lib/context/tenant-config';
import Modal from '@/components/ui/modal';
import Spinner from '@/components/ui/spinner';

export interface RescheduleTarget {
  id: string;
  staff_id: string | null;
  staff_name: string | null;
  slot_date: string;
  slot_start: string;
  duration_minutes: number;
}

interface StaffOption {
  id: string;
  pseudonym: string;
  status: string;
}

interface Slot {
  start: string;
  end: string;
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.slice(0, 5).split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  return `${String(hh).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Reschedule modal (Phase 20-A3): pick a new date + time slot, optionally
 * reassigning to another {staff}. Availability comes from the same public
 * slot API the widget uses; the server re-validates (excluding this booking)
 * and returns 409 on conflicts, which we surface inline without closing.
 */
export default function RescheduleBookingModal({
  slug,
  booking,
  onClose,
  onRescheduled,
}: {
  slug: string;
  booking: RescheduleTarget;
  onClose: () => void;
  onRescheduled: () => void;
}) {
  const { terminology } = useTenantConfig();

  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [staffId, setStaffId] = useState<string>(booking.staff_id ?? '');
  const [date, setDate] = useState<string>(booking.slot_date);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedStart, setSelectedStart] = useState<string>('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsReason, setSlotsReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/${slug}/staff`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        setStaffOptions((data.staff ?? []).filter((s: StaffOption) => s.status === 'active'));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const loadSlots = useCallback(async () => {
    if (!staffId || !date) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    setSlotsReason(null);
    setSelectedStart('');
    try {
      const res = await fetch(
        `/book/${slug}/api/availability?staff_id=${staffId}&date=${date}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSlots([]);
        setSlotsReason(data.error ?? 'Could not load availability');
        return;
      }
      setSlots(data.slots ?? []);
      if ((data.slots ?? []).length === 0) {
        setSlotsReason(data.reason ?? 'No open slots on this date');
      }
    } catch {
      setSlots([]);
      setSlotsReason('Network error loading availability');
    } finally {
      setLoadingSlots(false);
    }
  }, [slug, staffId, date]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  async function submit() {
    if (!selectedStart) {
      setError('Pick a new time slot.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/${slug}/bookings/${booking.id}/reschedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_date: date,
          slot_start: selectedStart,
          staff_id: staffId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 409 conflicts stay inline so the agent can pick another slot.
        setError(data.error ?? 'Could not reschedule');
        if (res.status === 409) await loadSlots();
        return;
      }
      toast.success(`${terminology.booking} rescheduled.`);
      onRescheduled();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const newEnd = selectedStart ? addMinutes(selectedStart, booking.duration_minutes) : '';

  return (
    <Modal title={`Reschedule ${terminology.booking}`} onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-4">
        <p className="text-xs text-fg-muted">
          Currently {booking.slot_date} at {booking.slot_start.slice(0, 5)}
          {booking.staff_name ? ` with ${booking.staff_name}` : ''} · {booking.duration_minutes} min
        </p>

        <div>
          <label className="block text-xs text-fg-muted mb-1">{terminology.staff}</label>
          <select
            value={staffId}
            onChange={e => setStaffId(e.target.value)}
            className="w-full text-sm bg-elevated text-fg border border-border rounded px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Select {terminology.staff.toLowerCase()}…</option>
            {staffOptions.map(s => (
              <option key={s.id} value={s.id}>
                {s.pseudonym}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-fg-muted mb-1">New date</label>
          <input
            type="date"
            value={date}
            min={todayStr}
            onChange={e => setDate(e.target.value)}
            className="w-full text-sm bg-elevated text-fg border border-border rounded px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div>
          <label className="block text-xs text-fg-muted mb-1">New time</label>
          {loadingSlots ? (
            <div className="flex justify-center py-4 text-fg-muted">
              <Spinner size="sm" />
            </div>
          ) : slots.length === 0 ? (
            <p className="text-xs text-fg-muted py-2">{slotsReason ?? 'Pick a date and staff member.'}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
              {slots.map(s => {
                const active = selectedStart === s.start;
                return (
                  <button
                    key={s.start}
                    type="button"
                    onClick={() => setSelectedStart(s.start)}
                    aria-pressed={active}
                    className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                      active
                        ? 'bg-fg text-canvas border-transparent'
                        : 'bg-elevated text-fg-muted border-border hover:border-border-strong'
                    }`}
                  >
                    {s.start.slice(0, 5)}
                  </button>
                );
              })}
            </div>
          )}
          {selectedStart && (
            <p className="text-[11px] text-fg-muted mt-1.5">
              New slot: {date} {selectedStart.slice(0, 5)}–{newEnd} ({booking.duration_minutes} min)
            </p>
          )}
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-sm px-3 py-1.5 text-fg hover:bg-elevated rounded"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !selectedStart}
            className="text-sm px-4 py-1.5 bg-fg text-canvas rounded hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? 'Rescheduling…' : 'Reschedule'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
