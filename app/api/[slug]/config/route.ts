import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { validateTerminology, validateFeatureFlags } from '@/lib/templates/validation';

// GET — return the tenant_config row for the authenticated agent's tenant.
export async function GET() {
  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: config, error } = await supabase
    .from('tenant_config')
    .select('*')
    .eq('tenant_id', user.tenantId)
    .maybeSingle();

  if (error) {
    console.error('[config:get] error:', error);
    return NextResponse.json({ error: 'Failed to load config' }, { status: 500 });
  }
  if (!config) {
    return NextResponse.json({ error: 'Config not found' }, { status: 404 });
  }

  return NextResponse.json({ config });
}

// PATCH — agents may edit terminology + feature_flags only. Compliance flags
// are super-admin-only.
export async function PATCH(request: NextRequest) {
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

  if ('compliance_flags' in body) {
    return NextResponse.json(
      { error: 'Compliance flags can only be modified by super admin.' },
      { status: 403 }
    );
  }

  const update: Record<string, unknown> = {};

  if ('terminology' in body) {
    const err = validateTerminology(body.terminology);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    update.terminology = body.terminology;
  }

  if ('feature_flags' in body) {
    const err = validateFeatureFlags(body.feature_flags);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    update.feature_flags = body.feature_flags;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 });
  }

  update.updated_at = new Date().toISOString();

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('tenant_config')
    .update(update)
    .eq('tenant_id', user.tenantId);

  if (error) {
    console.error('[config:patch] error:', error);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
