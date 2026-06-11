import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import type { AuthenticatedUser } from '@/lib/types/auth';

// DELETE — remove a day off. Agents may remove any; staff only their own.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; staffId: string; exceptionId: string }> }
) {
  const { staffId, exceptionId } = await params;

  let user: AuthenticatedUser;
  try {
    user = await requireRole(['agent', 'staff']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.role === 'staff' && user.staffId !== staffId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from('staff_exceptions')
    .select('id')
    .eq('id', exceptionId)
    .eq('tenant_id', user.tenantId)
    .eq('staff_id', staffId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('staff_exceptions')
    .delete()
    .eq('id', exceptionId)
    .eq('tenant_id', user.tenantId);

  if (error) {
    console.error('[exceptions:delete] error:', error);
    return NextResponse.json({ error: 'Failed to remove exception' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
