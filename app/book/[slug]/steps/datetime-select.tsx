'use client';

import { useEffect, useState } from 'react';
import Spinner from '@/components/ui/spinner';
import { useWidgetStrings } from '@/lib/widget-i18n-context';

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
  /** Booking window bounds — dates outside are disabled in the calendar. */
  minLeadTimeHours?: number;
  maxBookingDaysAhead?: number;
}

interface AvailabilityResponse {
  available: boolean;
  slots: Slot[];
  reason?: string;
  slotDurationMinutes?: number;
}

function toDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Compact month-grid date picker. Bounded below by the minimum lead time and
 * above by max_booking_days_ahead; out-of-range days are disabled. Per-day
 * availability hints are intentionally not shown (no month-level availability
 * API yet — noted as a follow-up).
 */
function MonthCalendar({
  selectedDate,
  onSelectDate,
  brandColor,
  minDateStr,
  maxDateStr,
}: {
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  brandColor: string;
  minDateStr: string;
  maxDateStr: string;
}) {
  const t = useWidgetStrings();
  const initial = selectedDate ?? minDateStr;
  const [viewYear, setViewYear] = useState(() => Number(initial.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => Number(initial.slice(5, 7)) - 1); // 0-based

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const monthLabel = firstOfMonth.toLocaleDateString(t.locale, { month: 'long', year: 'numeric' });

  // Monday-first column offset for the 1st of the month.
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const monthStartStr = toDateStr(firstOfMonth);
  const monthEndStr = toDateStr(new Date(viewYear, viewMonth, daysInMonth));
  const canPrev = monthStartStr > minDateStr;
  const canNext = monthEndStr < maxDateStr;

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  const cells: Array<string | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      toDateStr(new Date(viewYear, viewMonth, i + 1))
    ),
  ];

  return (
    <div className="w-card w-pad-sm">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          disabled={!canPrev}
          aria-label={t.prevMonth}
          className="w-round border w-bd w-sf w-hbd px-2 py-1 text-sm w-tx-soft disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none w-focus"
        >
          ‹
        </button>
        <p className="text-sm w-tx font-medium">{monthLabel}</p>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          disabled={!canNext}
          aria-label={t.nextMonth}
          className="w-round border w-bd w-sf w-hbd px-2 py-1 text-sm w-tx-soft disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none w-focus"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {t.weekdaysShort.map(d => (
          <p key={d} className="text-center text-[10px] w-tx3 uppercase tracking-wider">
            {d}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((dateStr, i) => {
          if (!dateStr) return <span key={`blank-${i}`} />;
          const inRange = dateStr >= minDateStr && dateStr <= maxDateStr;
          const isSelected = dateStr === selectedDate;
          return (
            <button
              key={dateStr}
              type="button"
              disabled={!inRange}
              onClick={() => onSelectDate(dateStr)}
              aria-pressed={isSelected}
              aria-label={dateStr}
              className={`w-round text-xs py-1.5 transition-colors focus:outline-none w-focus ${
                isSelected
                  ? 'text-white'
                  : inRange
                    ? 'w-tx-soft w-el hover:opacity-80'
                    : 'w-tx3 opacity-35 cursor-not-allowed'
              }`}
              style={isSelected ? { backgroundColor: brandColor } : undefined}
            >
              {Number(dateStr.slice(8, 10))}
            </button>
          );
        })}
      </div>
    </div>
  );
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
  minLeadTimeHours = 0,
  maxBookingDaysAhead = 30,
}: Props) {
  const t = useWidgetStrings();
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
        setError(t.availabilityError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, staffId, selectedDate, poolMode, poolTagKey, serviceTagKey]);

  // Earliest bookable day = the date of (now + lead time): no earlier date
  // can have a valid slot. Latest = max_booking_days_ahead.
  const now = new Date();
  const minDateStr = toDateStr(new Date(now.getTime() + Math.max(0, minLeadTimeHours) * 3600000));
  const maxDateStr = toDateStr(new Date(now.getTime() + maxBookingDaysAhead * 86400000));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs w-tx2 mb-2">{t.chooseDate}</p>
        <MonthCalendar
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
          brandColor={brandColor}
          minDateStr={minDateStr}
          maxDateStr={maxDateStr}
        />
      </div>

      {!selectedDate && (
        <p className="text-xs w-tx3 italic">
          {t.selectDateHint}
        </p>
      )}

      {selectedDate && (
        <div>
          <p className="text-xs w-tx2 mb-2">{t.chooseTime}</p>

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
              {/* Server reasons are English — only surface them on English chrome. */}
              {(t.locale === 'en-GB' ? reason : null) ?? t.noAvailability}
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
