import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// GET /api/[slug]/staff/availability-summary?date=YYYY-MM-DD — agent-only.
// Returns, for a single date, every active+onboarded staff member's working
// window(s), whether they have a day off, and their booked time ranges. Used
// by the Bookings calendar "All staff" day view (Phase 20-B). Separate queries
// merged in JS (embedded joins drop rows — see CLAUDE.md gotcha #2).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  await params; // slug resolved by middleware tenant scoping; not needed here

  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = user.tenantId;

  const date = request.nextUrl.searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date (YYYY-MM-DD) is required' }, { status: 400 });
  }
  const dayOfWeek = new Date(date + 'T00:00:00').getDay();

  const supabase = createServiceClient();

  // 1. Active, onboarded staff for this tenant.
  const { data: staffRows, error: staffError } = await supabase
    .from('staff')
    .select('id, pseudonym')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .eq('wizard_completed', true)
    .order('pseudonym');

  if (staffError) {
    console.error('[staff:availability-summary] staff error:', staffError);
    return NextResponse.json({ error: 'Failed to load staff' }, { status: 500 });
  }

  const staffIds = (staffRows ?? []).map(s => s.id as string);
  if (staffIds.length === 0) {
    return NextResponse.json({ date, staff: [] });
  }

  // 2-4. Schedules (this weekday), exceptions (this date), bookings (this date).
  const [scheduleRes, exceptionsRes, bookingsRes] = await Promise.all([
    supabase
      .from('staff_schedule')
      .select('staff_id, start_time, end_time')
      .eq('tenant_id', tenantId)
      .eq('day_of_week', dayOfWeek)
      .in('staff_id', staffIds),
    supabase
      .from('staff_exceptions')
      .select('staff_id, reason')
      .eq('tenant_id', tenantId)
      .eq('exception_date', date)
      .in('staff_id', staffIds),
    supabase
      .from('bookings')
      .select('id, staff_id, slot_start, slot_end, status')
      .eq('tenant_id', tenantId)
      .eq('slot_date', date)
      .in('staff_id', staffIds)
      .in('status', ['pending_staff', 'confirmed']),
  ]);

  if (scheduleRes.error || exceptionsRes.error || bookingsRes.error) {
    console.error(
      '[staff:availability-summary] query error:',
      scheduleRes.error ?? exceptionsRes.error ?? bookingsRes.error
    );
    return NextResponse.json({ error: 'Failed to load availability' }, { status: 500 });
  }

  const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '');

  // Index by staff_id.
  const scheduleByStaff: Record<string, Array<{ start: string; end: string }>> = {};
  for (const s of scheduleRes.data ?? []) {
    (scheduleByStaff[s.staff_id as string] ??= []).push({
      start: hhmm(s.start_time as string),
      end: hhmm(s.end_time as string),
    });
  }
  const dayOffByStaff: Record<string, string | null> = {};
  for (const e of exceptionsRes.data ?? []) {
    // First exception for the day wins for the reason label.
    if (!(e.staff_id in dayOffByStaff)) dayOffByStaff[e.staff_id as string] = e.reason ?? null;
  }
  const bookingsByStaff: Record<string, Array<{ id: string; start: string; end: string; status: string }>> = {};
  for (const b of bookingsRes.data ?? []) {
    (bookingsByStaff[b.staff_id as string] ??= []).push({
      id: b.id as string,
      start: hhmm(b.slot_start as string),
      end: hhmm(b.slot_end as string),
      status: b.status as string,
    });
  }

  const staff = (staffRows ?? []).map(s => {
    const id = s.id as string;
    const working = (scheduleByStaff[id] ?? []).sort((a, b) => a.start.localeCompare(b.start));
    const hasDayOff = id in dayOffByStaff;
    return {
      id,
      pseudonym: s.pseudonym as string,
      day_off: hasDayOff,
      day_off_reason: hasDayOff ? dayOffByStaff[id] : null,
      working_blocks: hasDayOff ? [] : working,
      bookings: (bookingsByStaff[id] ?? []).sort((a, b) => a.start.localeCompare(b.start)),
    };
  });

  return NextResponse.json({ date, staff });
}
