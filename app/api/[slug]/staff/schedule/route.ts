import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  await params;

  let user;
  try {
    user = await requireRole(['staff']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!user.staffId) {
    return NextResponse.json({ error: 'No staff record' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.schedule)) {
    return NextResponse.json({ error: 'schedule array required' }, { status: 400 });
  }

  const timeRe = /^\d{2}:\d{2}$/;
  const entries: Array<{ day_of_week: number; start_time: string; end_time: string }> = [];

  for (const item of body.schedule) {
    const dow = Number(item.day_of_week);
    if (isNaN(dow) || dow < 0 || dow > 6) continue;
    if (!timeRe.test(item.start_time) || !timeRe.test(item.end_time)) continue;
    if (item.start_time >= item.end_time) continue;
    entries.push({
      day_of_week: dow,
      start_time: item.start_time,
      end_time: item.end_time,
    });
  }

  if (entries.length === 0) {
    return NextResponse.json({ error: 'At least one valid schedule day required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  await supabase.from('staff_schedule').delete().eq('staff_id', user.staffId);

  const { error } = await supabase.from('staff_schedule').insert(
    entries.map(e => ({
      staff_id: user.staffId!,
      tenant_id: user.tenantId,
      ...e,
    }))
  );

  if (error) {
    console.error('[staff:schedule] update error:', error);
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: entries.length });
}
