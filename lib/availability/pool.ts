import type { SupabaseClient } from '@supabase/supabase-js';
import { checkAvailability } from './check';
import type { TimeSlot } from './check';

export interface PoolAvailabilityResult {
  available: boolean;
  /** Merged union of free intervals across all eligible staff. */
  slots: TimeSlot[];
  /** Free intervals per eligible staff member (parallel to eligible staff order). */
  staffSlots: TimeSlot[][];
  reason?: string;
}

/**
 * Eligible pool staff: active + wizard complete, and (when tagIds given)
 * offering at least one of the requested service tags.
 */
export async function getEligibleStaffIds(
  supabase: SupabaseClient,
  tenantId: string,
  tagIds?: string[]
): Promise<string[]> {
  const { data: staffRows } = await supabase
    .from('staff')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .eq('wizard_completed', true);

  const allIds = (staffRows ?? []).map(s => s.id as string);
  if (allIds.length === 0) return [];
  if (!tagIds || tagIds.length === 0) return allIds;

  const { data: joins } = await supabase
    .from('staff_service_tags')
    .select('staff_id')
    .in('staff_id', allIds)
    .in('tag_id', tagIds);

  return Array.from(new Set((joins ?? []).map(j => j.staff_id as string)));
}

/** Merge overlapping or touching intervals into a unified list. */
export function mergeSlots(slots: TimeSlot[]): TimeSlot[] {
  const sorted = [...slots].sort((a, b) => a.start.localeCompare(b.start));
  const merged: TimeSlot[] = [];
  for (const s of sorted) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) {
      if (s.end > last.end) last.end = s.end;
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}

/**
 * Pool availability = union of eligible staff free slots. A requested window is
 * available only when a single staff member can cover it entirely (a union
 * interval spanning two staff is not bookable as one appointment).
 */
export async function checkPoolAvailability(
  supabase: SupabaseClient,
  tenantId: string,
  date: string,
  tagIds?: string[],
  requestedStart?: string,
  requestedEnd?: string
): Promise<PoolAvailabilityResult> {
  const staffIds = await getEligibleStaffIds(supabase, tenantId, tagIds);
  if (staffIds.length === 0) {
    return {
      available: false,
      slots: [],
      staffSlots: [],
      reason: 'No eligible staff for this service',
    };
  }

  const results = await Promise.all(
    staffIds.map(id =>
      checkAvailability(supabase, tenantId, id, date, requestedStart, requestedEnd)
    )
  );

  const staffSlots = results.map(r => r.slots);
  const union = mergeSlots(staffSlots.flat());

  if (requestedStart && requestedEnd) {
    const fits = results.some(r => r.available);
    return {
      available: fits,
      slots: union,
      staffSlots,
      reason: fits ? undefined : 'Requested time not available',
    };
  }

  return {
    available: union.length > 0,
    slots: union,
    staffSlots,
    reason: union.length > 0 ? undefined : 'No availability on this date',
  };
}
