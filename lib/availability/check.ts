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

/**
 * 3-layer availability check:
 * Layer 1 — staff_schedule (recurring weekly schedule)
 * Layer 2 — staff_exceptions (day-off overrides)
 * Layer 3 — existing bookings (confirmed or pending_staff)
 */
export async function checkAvailability(
  supabase: SupabaseClient,
  tenantId: string,
  staffId: string,
  date: string,
  requestedStart?: string,
  requestedEnd?: string
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

  const bookedSlots = (bookingsRes.data ?? []).map(b => ({
    start: b.slot_start as string,
    end: b.slot_end as string,
  }));

  const freeSlots: TimeSlot[] = [];
  for (const block of scheduleBlocks) {
    const fragments = subtractBookings(block.start_time, block.end_time, bookedSlots);
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
