import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let user;
  try {
    user = await requireRole(['staff']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const staffId = body.staffId || user.staffId;
  if (!staffId) {
    return NextResponse.json({ error: 'staffId required' }, { status: 400 });
  }

  const selectedTagIds: string[] = Array.isArray(body.selected_tag_ids) ? body.selected_tag_ids : [];
  const schedule: Array<{ day_of_week: number; enabled: boolean; start_time: string; end_time: string }> =
    Array.isArray(body.schedule) ? body.schedule : [];

  const enabledDays = schedule.filter(s => s.enabled);
  if (selectedTagIds.length === 0) {
    return NextResponse.json({ error: 'At least one service tag required' }, { status: 400 });
  }
  if (enabledDays.length === 0) {
    return NextResponse.json({ error: 'At least one schedule day required' }, { status: 400 });
  }
  for (const d of enabledDays) {
    if (d.start_time >= d.end_time) {
      return NextResponse.json({ error: `Invalid schedule: start must be before end` }, { status: 400 });
    }
  }

  const supabase = createServiceClient();

  const socialLinks = body.social_links ?? {};
  const languages: string[] = Array.isArray(body.languages) ? body.languages : [];

  const { error: staffError } = await supabase
    .from('staff')
    .update({
      pseudonym: body.pseudonym || undefined,
      bio: body.bio || null,
      languages: languages.length > 0 ? languages : null,
      social_links: socialLinks,
      gender: body.gender || null,
      nationality: body.nationality || null,
      age: body.age || null,
      wizard_completed: true,
      first_login: false,
      status: 'active',
    })
    .eq('id', staffId);

  if (staffError) {
    console.error('staff update error:', staffError);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }

  await supabase.from('staff_service_tags').delete().eq('staff_id', staffId);
  if (selectedTagIds.length > 0) {
    await supabase.from('staff_service_tags').insert(
      selectedTagIds.map(tag_id => ({
        staff_id: staffId,
        tag_id,
        tenant_id: user.tenantId,
      }))
    );
  }

  await supabase.from('staff_schedule').delete().eq('staff_id', staffId);
  const scheduleRows = enabledDays.map(s => ({
    staff_id: staffId,
    tenant_id: user.tenantId,
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
  }));
  if (scheduleRows.length > 0) {
    await supabase.from('staff_schedule').insert(scheduleRows);
  }

  return NextResponse.json({ ok: true, redirect: `/${slug}/dashboard` });
}
