import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const email = body?.email?.toLowerCase()?.trim();
  const reason: string | null = body?.reason?.trim() || null;

  if (!email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Resolve agent.id for blocked_by from agents table (audit trail)
  const { data: agentRow } = await supabase
    .from('agents')
    .select('id')
    .eq('tenant_id', user.tenantId)
    .eq('email', user.email)
    .maybeSingle();

  // Upsert via the (tenant_id, email) unique constraint added in Phase 3
  const { error } = await supabase
    .from('guest_blocks')
    .upsert(
      {
        tenant_id: user.tenantId,
        email,
        reason,
        blocked_by: agentRow?.id ?? null,
      },
      { onConflict: 'tenant_id,email' }
    );

  if (error) {
    console.error('[guests:block] error:', error);
    return NextResponse.json({ error: 'Failed to block guest' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
