'use client';

import { useEffect, useState } from 'react';
import Spinner from '@/components/ui/spinner';

interface Slot {
  start: string;
  end: string;
}

interface Props {
  slug: string;
  staffId: string | null;
  poolMode?: boolean;
  poolTagIds?: string[];
  /** Selected service tags — drives per-service slot duration when enabled. */
  serviceTagIds?: string[];
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
  poolMode = false,
  poolTagIds = [],
  serviceTagIds = [],
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

  // Stable keys so the effect doesn't re-fire on every render from a fresh array.
  const poolTagKey = poolTagIds.join(',');
  const serviceTagKey = serviceTagIds.join(',');

  useEffect(() => {
    if (!selectedDate || (!poolMode && !staffId)) {
      setSlots([]);
      setReason(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setReason(null);

    const durationParam = serviceTagKey ? `&service_tag_ids=${serviceTagKey}` : '';
    const url = poolMode
      ? `/book/${slug}/api/pool-availability?date=${selectedDate}${poolTagKey ? `&tag_ids=${poolTagKey}` : ''}${durationParam}`
      : `/book/${slug}/api/availability?staff_id=${staffId}&date=${selectedDate}${durationParam}`;

    fetch(url)
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
  }, [slug, staffId, selectedDate, poolMode, poolTagKey, serviceTagKey]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs w-tx2 mb-2">Choose a date</p>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
          {dateChips.map(d => {
            const isSelected = d.value === selectedDate;
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => onSelectDate(d.value)}
                aria-pressed={isSelected}
                className={`shrink-0 snap-start w-round border px-3 py-2 text-xs transition-colors focus:outline-none w-focus ${
                  isSelected
                    ? 'text-white border-transparent'
                    : 'w-tx-soft w-bd w-sf w-hbd'
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
        <p className="text-xs w-tx3 italic">
          ← Select a date to see available times
        </p>
      )}

      {selectedDate && (
        <div>
          <p className="text-xs w-tx2 mb-2">Choose a time</p>

          {loading && (
            <div className="flex justify-center py-6 w-tx3">
              <Spinner size="md" />
            </div>
          )}

          {!loading && error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          {!loading && !error && slots.length === 0 && (
            <p className="text-xs w-tx3 italic">
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
                    className={`w-round border py-2.5 text-sm transition-colors focus:outline-none w-focus ${
                      isSelected
                        ? 'text-white border-transparent'
                        : 'w-tx-soft w-bd w-sf w-hbd'
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
