import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

// GET — a staff member's weekly schedule + upcoming day-off exceptions, for the
// Bookings calendar availability overlay (Phase 19 A7). Agents may read any
// staff member; staff may read only their own.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; staffId: string }> }
) {
  const { staffId } = await params;

  let user;
  try {
    user = await requireRole(['agent', 'staff']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.role === 'staff' && user.staffId !== staffId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().split('T')[0];

  const [scheduleRes, exceptionsRes] = await Promise.all([
    supabase
      .from('staff_schedule')
      .select('day_of_week, start_time, end_time')
      .eq('tenant_id', user.tenantId)
      .eq('staff_id', staffId)
      .order('day_of_week'),
    supabase
      .from('staff_exceptions')
      .select('exception_date, reason')
      .eq('tenant_id', user.tenantId)
      .eq('staff_id', staffId)
      .gte('exception_date', today)
      .order('exception_date'),
  ]);

  if (scheduleRes.error || exceptionsRes.error) {
    console.error('[staff:availability] error:', scheduleRes.error ?? exceptionsRes.error);
    return NextResponse.json({ error: 'Failed to load availability' }, { status: 500 });
  }

  return NextResponse.json({
    schedule: (scheduleRes.data ?? []).map(s => ({
      day_of_week: s.day_of_week,
      start_time: (s.start_time as string).slice(0, 5),
      end_time: (s.end_time as string).slice(0, 5),
    })),
    exceptions: (exceptionsRes.data ?? []).map(e => ({
      date: e.exception_date,
      reason: e.reason ?? null,
    })),
  });
}
