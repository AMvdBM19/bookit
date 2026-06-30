import type { SupabaseClient } from '@supabase/supabase-js';
import type { TimeSlot } from './check';

export interface BusinessHourRow {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_active: boolean;
}

export async function getBusinessHours(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ enabled: boolean; hours: BusinessHourRow[] }> {
  const [{ data: settings }, { data: hours }] = await Promise.all([
    supabase
      .from('tenant_settings')
      .select('business_hours_enabled')
      .eq('tenant_id', tenantId)
      .single(),
    supabase
      .from('business_hours')
      .select('day_of_week, open_time, close_time, is_active')
      .eq('tenant_id', tenantId),
  ]);

  return {
    enabled: settings?.business_hours_enabled === true,
    hours: (hours ?? []) as BusinessHourRow[],
  };
}

export function getBusinessWindow(
  hours: BusinessHourRow[],
  dayOfWeek: number
): TimeSlot | null {
  const row = hours.find(h => h.day_of_week === dayOfWeek && h.is_active);
  if (!row) return null;
  const open = row.open_time.slice(0, 5);
  const close = row.close_time.slice(0, 5);
  return { start: open, end: close };
}

export function clampSlotsToBusinessHours(
  slots: TimeSlot[],
  window: TimeSlot
): TimeSlot[] {
  const result: TimeSlot[] = [];
  for (const slot of slots) {
    const start = slot.start < window.start ? window.start : slot.start;
    const end = slot.end > window.end ? window.end : slot.end;
    if (start < end) result.push({ start, end });
  }
  return result;
}
