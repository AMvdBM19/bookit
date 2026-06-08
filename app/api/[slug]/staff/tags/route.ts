import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

export async function PATCH(
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
  if (!body || !Array.isArray(body.tag_ids)) {
    return NextResponse.json({ error: 'tag_ids array required' }, { status: 400 });
  }

  const tagIds: string[] = body.tag_ids.filter((id: unknown) => typeof id === 'string');
  if (tagIds.length === 0) {
    return NextResponse.json({ error: 'At least one tag required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: validTags } = await supabase
    .from('service_tags')
    .select('id')
    .eq('tenant_id', user.tenantId)
    .eq('is_active', true)
    .in('id', tagIds);

  const validIds = (validTags ?? []).map(t => t.id);
  if (validIds.length === 0) {
    return NextResponse.json({ error: 'No valid tags found' }, { status: 400 });
  }

  await supabase.from('staff_service_tags').delete().eq('staff_id', user.staffId);

  const { error } = await supabase.from('staff_service_tags').insert(
    validIds.map(tag_id => ({
      staff_id: user.staffId!,
      tag_id,
      tenant_id: user.tenantId,
    }))
  );

  if (error) {
    console.error('[staff:tags] update error:', error);
    return NextResponse.json({ error: 'Failed to update tags' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: validIds.length });
}
