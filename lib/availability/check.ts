import type { SupabaseClient } from '@supabase/supabase-js';

export interface TimeSlot {
  start: string;
  end: string;
}

export interface AvailabilityResult {
  available: boolean;
  slots: TimeSlot[];
  reason?: string;
}

export interface AvailabilityOptions {
  /** Minutes blocked before each existing booking (prep time). */
  bufferBeforeMinutes?: number;
  /** Minutes blocked after each existing booking (cleanup time). */
  bufferAfterMinutes?: number;
}

/** Shift an HH:MM time by a signed number of minutes, clamped to 00:00–23:59. */
function shiftTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = Math.max(0, Math.min(23 * 60 + 59, h * 60 + m + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * 3-layer availability check:
 * Layer 1 — staff_schedule (recurring weekly schedule)
 * Layer 2 — staff_exceptions (day-off overrides)
 * Layer 3 — existing bookings (confirmed or pending_staff), expanded by
 *           the tenant's buffer_before/after minutes when provided
 */
export async function checkAvailability(
  supabase: SupabaseClient,
  tenantId: string,
  staffId: string,
  date: string,
  requestedStart?: string,
  requestedEnd?: string,
  options?: AvailabilityOptions
): Promise<AvailabilityResult> {
  const dayOfWeek = new Date(date + 'T00:00:00').getDay();

  const [scheduleRes, exceptionsRes, bookingsRes] = await Promise.all([
    supabase
      .from('staff_schedule')
      .select('start_time, end_time')
      .eq('staff_id', staffId)
      .eq('tenant_id', tenantId)
      .eq('day_of_week', dayOfWeek),
    supabase
      .from('staff_exceptions')
      .select('id')
      .eq('staff_id', staffId)
      .eq('tenant_id', tenantId)
      .eq('exception_date', date),
    supabase
      .from('bookings')
      .select('slot_start, slot_end')
      .eq('staff_id', staffId)
      .eq('tenant_id', tenantId)
      .eq('slot_date', date)
      .in('status', ['pending_staff', 'confirmed']),
  ]);

  if (exceptionsRes.data && exceptionsRes.data.length > 0) {
    return { available: false, slots: [], reason: 'Staff has a day off on this date' };
  }

  const scheduleBlocks = scheduleRes.data ?? [];
  if (scheduleBlocks.length === 0) {
    return { available: false, slots: [], reason: 'Staff has no schedule for this day' };
  }

  const bufferBefore = options?.bufferBeforeMinutes ?? 0;
  const bufferAfter = options?.bufferAfterMinutes ?? 0;

  const bookedSlots = (bookingsRes.data ?? []).map(b => ({
    start: shiftTime((b.slot_start as string).slice(0, 5), -bufferBefore),
    end: shiftTime((b.slot_end as string).slice(0, 5), bufferAfter),
  }));

  const freeSlots: TimeSlot[] = [];
  for (const block of scheduleBlocks) {
    const start = (block.start_time as string).slice(0, 5);
    const end = (block.end_time as string).slice(0, 5);
    const fragments = subtractBookings(start, end, bookedSlots);
    freeSlots.push(...fragments);
  }

  if (requestedStart && requestedEnd) {
    const fits = freeSlots.some(
      s => requestedStart >= s.start && requestedEnd <= s.end
    );
    return {
      available: fits,
      slots: freeSlots,
      reason: fits ? undefined : 'Requested time not available',
    };
  }

  return { available: freeSlots.length > 0, slots: freeSlots };
}

function subtractBookings(start: string, end: string, bookings: TimeSlot[]): TimeSlot[] {
  const relevant = bookings
    .filter(b => b.start < end && b.end > start)
    .sort((a, b) => a.start.localeCompare(b.start));

  if (relevant.length === 0) return [{ start, end }];

  const result: TimeSlot[] = [];
  let cursor = start;

  for (const booking of relevant) {
    if (cursor < booking.start) {
      result.push({ start: cursor, end: booking.start });
    }
    cursor = booking.end > cursor ? booking.end : cursor;
  }

  if (cursor < end) {
    result.push({ start: cursor, end });
  }

  return result;
}
