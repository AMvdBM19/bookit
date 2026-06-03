import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validateSuperAdminKey } from '@/lib/auth/super-admin';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  if (!validateSuperAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tenantId } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (typeof body.is_active === 'boolean') update.is_active = body.is_active;
  if (typeof body.subscription_tier === 'string') update.subscription_tier = body.subscription_tier;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No allowed fields provided' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from('tenants').update(update).eq('id', tenantId);

  if (error) {
    console.error('[super-admin:tenants:patch] error:', error);
    return NextResponse.json({ error: 'Failed to update tenant' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  if (!validateSuperAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tenantId } = await params;
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('tenants')
    .update({ is_active: false })
    .eq('id', tenantId);

  if (error) {
    console.error('[super-admin:tenants:delete] error:', error);
    return NextResponse.json({ error: 'Failed to deactivate tenant' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
