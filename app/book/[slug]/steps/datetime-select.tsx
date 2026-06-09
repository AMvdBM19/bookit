'use client';

import { useEffect, useState } from 'react';

interface Slot {
  start: string;
  end: string;
}

interface Props {
  slug: string;
  staffId: string;
  selectedDate: string | null;
  selectedSlot: Slot | null;
  onSelectDate: (date: string) => void;
  onSelectSlot: (slot: Slot) => void;
  brandColor: string;
}

interface AvailabilityResponse {
  available: boolean;
  slots: Slot[];
  reason?: string;
  slotDurationMinutes?: number;
}

function buildDateChips(): Array<{ value: string; label: string }> {
  const chips: Array<{ value: string; label: string }> = [];
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const value = `${year}-${month}-${day}`;
    const label = d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    chips.push({ value, label });
  }
  return chips;
}

export default function DateTimeSelect({
  slug,
  staffId,
  selectedDate,
  selectedSlot,
  onSelectDate,
  onSelectSlot,
  brandColor,
}: Props) {
  const [dateChips] = useState(buildDateChips);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedDate) {
      setSlots([]);
      setReason(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setReason(null);

    fetch(`/book/${slug}/api/availability?staff_id=${staffId}&date=${selectedDate}`)
      .then(res => res.json())
      .then((data: AvailabilityResponse) => {
        if (cancelled) return;
        setSlots(data.slots ?? []);
        setReason(data.reason ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Failed to load availability. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, staffId, selectedDate]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-zinc-400 mb-2">Choose a date</p>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
          {dateChips.map(d => {
            const isSelected = d.value === selectedDate;
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => onSelectDate(d.value)}
                aria-pressed={isSelected}
                className={`shrink-0 snap-start rounded-lg border px-3 py-2 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                  isSelected
                    ? 'text-white border-transparent'
                    : 'text-zinc-300 border-zinc-800 bg-zinc-900 hover:border-zinc-600'
                }`}
                style={isSelected ? { backgroundColor: brandColor } : undefined}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {!selectedDate && (
        <p className="text-xs text-zinc-600 italic">
          ← Select a date to see available times
        </p>
      )}

      {selectedDate && (
        <div>
          <p className="text-xs text-zinc-400 mb-2">Choose a time</p>

          {loading && (
            <p className="text-xs text-zinc-500 italic">Loading slots…</p>
          )}

          {!loading && error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          {!loading && !error && slots.length === 0 && (
            <p className="text-xs text-zinc-500 italic">
              {reason ?? 'No availability on this date. Try another day.'}
            </p>
          )}

          {!loading && slots.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map(slot => {
                const isSelected =
                  selectedSlot?.start === slot.start && selectedSlot?.end === slot.end;
                return (
                  <button
                    key={`${slot.start}-${slot.end}`}
                    type="button"
                    onClick={() => onSelectSlot(slot)}
                    aria-pressed={isSelected}
                    className={`rounded-lg border py-2.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                      isSelected
                        ? 'text-white border-transparent'
                        : 'text-zinc-300 border-zinc-800 bg-zinc-900 hover:border-zinc-600'
                    }`}
                    style={isSelected ? { backgroundColor: brandColor } : undefined}
                  >
                    {slot.start}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
