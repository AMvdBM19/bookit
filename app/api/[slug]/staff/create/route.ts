import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import type { FeatureFlags } from '@/lib/types/tenant-config';
import { DEFAULT_FEATURE_FLAGS } from '@/lib/types/tenant-config';

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: 'email and password required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Enforce the tenant's staff seat limit (Phase 19 A6). Counts active staff
  // against tenant_settings.max_staff (defaults to 5).
  const [{ data: limitSettings }, { count: activeCount }] = await Promise.all([
    supabase.from('tenant_settings').select('max_staff').eq('tenant_id', user.tenantId).maybeSingle(),
    supabase
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', user.tenantId)
      .eq('status', 'active'),
  ]);
  const maxStaff = limitSettings?.max_staff ?? 5;
  if ((activeCount ?? 0) >= maxStaff) {
    return NextResponse.json(
      { error: `Staff limit reached. Your plan allows up to ${maxStaff} team members.` },
      { status: 403 }
    );
  }

  const { data: tenantConfig } = await supabase
    .from('tenant_config')
    .select('feature_flags')
    .eq('tenant_id', user.tenantId)
    .maybeSingle();

  const featureFlags = (tenantConfig?.feature_flags as FeatureFlags | undefined) ?? DEFAULT_FEATURE_FLAGS;
  if (featureFlags.staff_require_pseudonym && !body.pseudonym) {
    return NextResponse.json({ error: 'pseudonym required for this template' }, { status: 400 });
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    app_metadata: {
      tenant_id: user.tenantId,
      user_role: 'staff',
    },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const { data: staffRow, error: staffError } = await supabase
    .from('staff')
    .insert({
      id: authData.user.id,
      tenant_id: user.tenantId,
      pseudonym: body.pseudonym || body.email.split('@')[0],
      real_name: body.real_name || null,
      status: 'inactive',
      first_login: true,
      wizard_completed: false,
      social_links: {},
    })
    .select('id')
    .single();

  if (staffError) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: 'Failed to create staff record' }, { status: 500 });
  }

  await supabase.auth.admin.updateUserById(authData.user.id, {
    app_metadata: {
      tenant_id: user.tenantId,
      user_role: 'staff',
      staff_id: staffRow.id,
    },
  });

  return NextResponse.json({ ok: true, staffId: staffRow.id });
}
