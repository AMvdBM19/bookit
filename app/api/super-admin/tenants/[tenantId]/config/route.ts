import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validateSuperAdminKey } from '@/lib/auth/super-admin';
import {
  validateTerminology,
  validateFeatureFlags,
  validateComplianceFlags,
} from '@/lib/templates/validation';

// PATCH — super admin may edit any tenant_config field, including compliance.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  if (!validateSuperAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tenantId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
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

  if ('compliance_flags' in body) {
    const err = validateComplianceFlags(body.compliance_flags);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    update.compliance_flags = body.compliance_flags;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 });
  }

  update.updated_at = new Date().toISOString();

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('tenant_config')
    .update(update)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('[super-admin:tenant-config:patch] error:', error);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
