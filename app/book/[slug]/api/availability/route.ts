import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkAvailability } from '@/lib/availability/check';
import { effectiveDurationMinutes } from '@/lib/availability/duration';
import { getBusinessHours, getBusinessWindow, clampSlotsToBusinessHours } from '@/lib/availability/business-hours';

export const dynamic = 'force-dynamic';

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60);
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const staffId = request.nextUrl.searchParams.get('staff_id');
  const date = request.nextUrl.searchParams.get('date');

  if (!staffId || !date) {
    return NextResponse.json({ error: 'staff_id and date are required' }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date format (YYYY-MM-DD)' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, is_active')
    .eq('slug', slug)
    .single();

  if (tenantError) {
    console.error('[availability] Tenant query error:', tenantError.message);
  }

  if (!tenant || !tenant.is_active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('id')
    .eq('id', staffId)
    .eq('tenant_id', tenant.id)
    .eq('status', 'active')
    .single();

  if (staffError) {
    console.error('[availability] Staff query error:', staffError.message);
  }

  if (!staff) {
    return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
  }

  const { data: settings, error: settingsError } = await supabase
    .from('tenant_settings')
    .select('*')
    .eq('tenant_id', tenant.id)
    .single();

  if (settingsError) {
    console.error('[availability] Settings query error:', settingsError.message);
  }

  const defaultSlotMinutes = settings?.default_slot_minutes ?? 30;
  let slotMinutes = defaultSlotMinutes;
  const minLeadHours = settings?.min_lead_time_hours ?? 2;
  const maxDaysAhead = settings?.max_booking_days_ahead ?? 30;

  // Per-service duration: when the tenant flag is on and the widget passes the
  // selected service tags, the slot length becomes the sum of their durations.
  const tagIdsParam = request.nextUrl.searchParams.get('service_tag_ids');
  if (settings?.per_service_duration_enabled && tagIdsParam) {
    const tagIds = tagIdsParam.split(',').map(s => s.trim()).filter(Boolean);
    if (tagIds.length > 0) {
      const { data: tagRows } = await supabase
        .from('service_tags')
        .select('id, duration_minutes, blocks_slot')
        .in('id', tagIds)
        .eq('tenant_id', tenant.id);
      // Only blocks_slot tags contribute time; all-non-blocking falls back to
      // the default slot length.
      slotMinutes = effectiveDurationMinutes(tagRows ?? [], defaultSlotMinutes);
    }
  }

  const today = new Date();
  const todayDateStr = today.toISOString().split('T')[0];
  const requestedDate = new Date(date + 'T00:00:00');
  const maxDate = new Date(today.getTime() + maxDaysAhead * 86400000);

  if (date < todayDateStr) {
    return NextResponse.json({ available: false, slots: [], reason: 'Date is in the past' });
  }
  if (requestedDate > maxDate) {
    return NextResponse.json({
      available: false,
      slots: [],
      reason: `Bookings limited to ${maxDaysAhead} days ahead`,
    });
  }

  if (date === todayDateStr) {
    const minTime = new Date(today.getTime() + minLeadHours * 3600000);
    if (minTime.getHours() >= 23) {
      return NextResponse.json({
        available: false,
        slots: [],
        reason: 'No slots available today with minimum lead time',
      });
    }
  }

  const bh = await getBusinessHours(supabase, tenant.id);
  const dayOfWeek = new Date(date + 'T00:00:00').getDay();

  if (bh.enabled) {
    const window = getBusinessWindow(bh.hours, dayOfWeek);
    if (!window) {
      return NextResponse.json({
        available: false,
        slots: [],
        reason: 'Business is closed on this day',
        date,
      });
    }
  }

  const result = await checkAvailability(supabase, tenant.id, staffId, date, undefined, undefined, {
    bufferBeforeMinutes: settings?.buffer_before_minutes ?? 0,
    bufferAfterMinutes: settings?.buffer_after_minutes ?? 0,
  });

  let freeSlots = result.slots;
  if (bh.enabled) {
    const window = getBusinessWindow(bh.hours, dayOfWeek)!;
    freeSlots = clampSlotsToBusinessHours(freeSlots, window);
  }

  const discreteSlots: Array<{ start: string; end: string }> = [];
  const now = new Date();
  const leadCutoff = new Date(now.getTime() + minLeadHours * 3600000);

  for (const slot of freeSlots) {
    let cursor = slot.start;
    while (true) {
      const endTime = addMinutes(cursor, slotMinutes);
      if (endTime > slot.end) break;

      if (date === todayDateStr) {
        const slotDateTime = new Date(`${date}T${cursor}`);
        if (slotDateTime < leadCutoff) {
          cursor = endTime;
          continue;
        }
      }

      discreteSlots.push({ start: cursor, end: endTime });
      cursor = endTime;
    }
  }

  return NextResponse.json({
    available: discreteSlots.length > 0,
    slots: discreteSlots,
    slotDurationMinutes: slotMinutes,
    date,
  });
}
