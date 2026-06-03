import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

const ALLOWED = ['approved', 'suspended'] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; clientId: string }> }
) {
  const { clientId } = await params;

  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (!status || !ALLOWED.includes(status)) {
    return NextResponse.json({ error: 'status must be approved or suspended' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from('clients')
    .select('id, tenant_id, status')
    .eq('id', clientId)
    .single();

  if (!existing || existing.tenant_id !== user.tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Resolve agent.id for audit trail
  const { data: agentRow } = await supabase
    .from('agents')
    .select('id')
    .eq('tenant_id', user.tenantId)
    .eq('email', user.email)
    .maybeSingle();

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status,
    status_changed_at: now,
    status_changed_by: agentRow?.id ?? user.email,
    changed_by_agent_id: agentRow?.id ?? null,
  };
  if (status === 'approved') {
    update.approved_at = now;
  }

  const { error: updateError } = await supabase
    .from('clients')
    .update(update)
    .eq('id', clientId);

  if (updateError) {
    console.error('[clients:status] update error:', updateError);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }

  // Audit log
  await supabase.from('client_status_log').insert({
    tenant_id: user.tenantId,
    client_id: clientId,
    from_status: existing.status,
    to_status: status,
    reason: body?.reason ?? `Set to ${status} by agent`,
    changed_by: agentRow?.id ?? user.email,
    changed_by_agent_id: agentRow?.id ?? null,
  });

  return NextResponse.json({ ok: true, status });
}
