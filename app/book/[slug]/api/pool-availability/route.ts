import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkPoolAvailability } from '@/lib/availability/pool';

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
  const date = request.nextUrl.searchParams.get('date');
  const tagIdsParam = request.nextUrl.searchParams.get('tag_ids');
  const tagIds = tagIdsParam
    ? tagIdsParam.split(',').map(s => s.trim()).filter(Boolean)
    : undefined;

  if (!date) {
    return NextResponse.json({ error: 'date is required' }, { status: 400 });
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
    console.error('[pool-availability] Tenant query error:', tenantError.message);
  }

  if (!tenant || !tenant.is_active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: settings, error: settingsError } = await supabase
    .from('tenant_settings')
    .select('*')
    .eq('tenant_id', tenant.id)
    .single();

  if (settingsError) {
    console.error('[pool-availability] Settings query error:', settingsError.message);
  }

  let slotMinutes = settings?.default_slot_minutes ?? 30;
  const minLeadHours = settings?.min_lead_time_hours ?? 2;
  const maxDaysAhead = settings?.max_booking_days_ahead ?? 30;

  // Per-service duration: slot length becomes the sum of the selected tags'
  // durations when the tenant flag is on.
  const serviceTagIdsParam = request.nextUrl.searchParams.get('service_tag_ids');
  if (settings?.per_service_duration_enabled && serviceTagIdsParam) {
    const serviceTagIds = serviceTagIdsParam.split(',').map(s => s.trim()).filter(Boolean);
    if (serviceTagIds.length > 0) {
      const { data: tagRows } = await supabase
        .from('service_tags')
        .select('id, duration_minutes')
        .in('id', serviceTagIds)
        .eq('tenant_id', tenant.id);
      const total = (tagRows ?? []).reduce(
        (sum, t) => sum + (typeof t.duration_minutes === 'number' ? t.duration_minutes : 0),
        0
      );
      if (total > 0) slotMinutes = total;
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

  const result = await checkPoolAvailability(supabase, tenant.id, date, tagIds, undefined, undefined, {
    bufferBeforeMinutes: settings?.buffer_before_minutes ?? 0,
    bufferAfterMinutes: settings?.buffer_after_minutes ?? 0,
  });

  // Split each staff member's free intervals into discrete slots, then dedupe
  // across staff. Splitting per-staff (rather than the merged union) guarantees
  // every offered slot fits within a single staff member's free time.
  const now = new Date();
  const leadCutoff = new Date(now.getTime() + minLeadHours * 3600000);
  const seen = new Set<string>();
  const discreteSlots: Array<{ start: string; end: string }> = [];

  for (const staffFreeSlots of result.staffSlots) {
    for (const slot of staffFreeSlots) {
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

        const key = `${cursor}-${endTime}`;
        if (!seen.has(key)) {
          seen.add(key);
          discreteSlots.push({ start: cursor, end: endTime });
        }
        cursor = endTime;
      }
    }
  }

  discreteSlots.sort((a, b) => a.start.localeCompare(b.start));

  return NextResponse.json({
    available: discreteSlots.length > 0,
    slots: discreteSlots,
    slotDurationMinutes: slotMinutes,
    date,
    reason: discreteSlots.length === 0 ? result.reason ?? 'No availability on this date' : undefined,
  });
}
