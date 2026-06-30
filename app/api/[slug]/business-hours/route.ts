import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

interface HourRow {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_active: boolean;
}

export async function GET() {
  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: rows, error } = await supabase
    .from('business_hours')
    .select('day_of_week, open_time, close_time, is_active')
    .eq('tenant_id', user.tenantId)
    .order('day_of_week');

  if (error) {
    console.error('[business-hours:get]', error);
    return NextResponse.json({ error: 'Failed to load business hours' }, { status: 500 });
  }

  const { data: settings } = await supabase
    .from('tenant_settings')
    .select('business_hours_enabled')
    .eq('tenant_id', user.tenantId)
    .single();

  return NextResponse.json({
    enabled: settings?.business_hours_enabled ?? false,
    hours: rows ?? [],
  });
}

export async function PUT(request: NextRequest) {
  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const enabled = body.enabled === true;
  const hours: HourRow[] = Array.isArray(body.hours) ? body.hours : [];

  const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;
  for (const h of hours) {
    if (typeof h.day_of_week !== 'number' || h.day_of_week < 0 || h.day_of_week > 6) {
      return NextResponse.json({ error: 'Invalid day_of_week' }, { status: 400 });
    }
    if (!TIME_RE.test(h.open_time) || !TIME_RE.test(h.close_time)) {
      return NextResponse.json({ error: 'Invalid time format' }, { status: 400 });
    }
    if (h.open_time >= h.close_time) {
      return NextResponse.json({ error: 'open_time must be before close_time' }, { status: 400 });
    }
  }

  if (enabled && hours.filter(h => h.is_active).length === 0) {
    return NextResponse.json(
      { error: 'At least one open day is required when business hours are enabled' },
      { status: 400 }
    );
  }

  const seen = new Set<number>();
  for (const h of hours) {
    if (seen.has(h.day_of_week)) {
      return NextResponse.json({ error: `Duplicate day_of_week: ${h.day_of_week}` }, { status: 400 });
    }
    seen.add(h.day_of_week);
  }

  const supabase = createServiceClient();
  const tenantId = user.tenantId;

  const { error: settingsError } = await supabase
    .from('tenant_settings')
    .update({ business_hours_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId);

  if (settingsError) {
    console.error('[business-hours:put] settings update error:', settingsError);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }

  const { error: deleteError } = await supabase
    .from('business_hours')
    .delete()
    .eq('tenant_id', tenantId);

  if (deleteError) {
    console.error('[business-hours:put] delete error:', deleteError);
    return NextResponse.json({ error: 'Failed to update business hours' }, { status: 500 });
  }

  if (hours.length > 0) {
    const rows = hours.map(h => ({
      tenant_id: tenantId,
      day_of_week: h.day_of_week,
      open_time: h.open_time,
      close_time: h.close_time,
      is_active: h.is_active !== false,
    }));

    const { error: insertError } = await supabase
      .from('business_hours')
      .insert(rows);

    if (insertError) {
      console.error('[business-hours:put] insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save business hours' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
