import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

const ALLOWED = ['active', 'inactive'] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; staffId: string }> }
) {
  const { staffId } = await params;

  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (!status || !ALLOWED.includes(status)) {
    return NextResponse.json({ error: 'status must be active or inactive' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify tenant ownership
  const { data: existing } = await supabase
    .from('staff')
    .select('id, tenant_id')
    .eq('id', staffId)
    .single();

  if (!existing || existing.tenant_id !== user.tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('staff')
    .update({ status })
    .eq('id', staffId);

  if (error) {
    console.error('[staff:status] error:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status });
}
