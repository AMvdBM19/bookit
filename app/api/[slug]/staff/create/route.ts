import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { getVerticalConfig } from '@/lib/verticals';
import { resolveTenant } from '@/lib/auth/tenant';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

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

  const tenant = await resolveTenant(slug);
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const config = getVerticalConfig(tenant.vertical);
  if (config.staff_require_pseudonym && !body.pseudonym) {
    return NextResponse.json({ error: 'pseudonym required for this vertical' }, { status: 400 });
  }

  const supabase = createServiceClient();

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
