import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validateSuperAdminKey } from '@/lib/auth/super-admin';
import { getVerticalConfig, isValidVertical } from '@/lib/verticals';
import type { VerticalId } from '@/lib/verticals/types';

const RESERVED_SLUGS = [
  'super-admin',
  'book',
  'api',
  'login',
  'logout',
  'setup',
  'staff-setup',
  'change-password',
  'dashboard',
  'auth',
  'admin',
  '_next',
];

function defaultTemplates() {
  return [
    {
      event_type: 'booking_confirmed',
      channel: 'whatsapp',
      subject: null,
      body: 'Hi [client_name], your booking with [staff_name] on [date] at [time] ([duration] min) is confirmed. [agency_name]',
    },
    {
      event_type: 'booking_confirmed',
      channel: 'email',
      subject: 'Booking confirmed — [agency_name]',
      body: 'Hi [client_name],\n\nYour booking with [staff_name] on [date] at [time] ([duration] min) is confirmed.\n\nThanks,\n[agency_name]',
    },
    {
      event_type: 'booking_declined',
      channel: 'whatsapp',
      subject: null,
      body: 'Hi [client_name], unfortunately [staff_name] is not available at your requested time. Please try another slot. [agency_name]',
    },
    {
      event_type: 'booking_declined',
      channel: 'email',
      subject: 'Booking request unavailable — [agency_name]',
      body: 'Hi [client_name],\n\nUnfortunately [staff_name] is not available at your requested time on [date] [time]. Please try another slot.\n\n[agency_name]',
    },
    {
      event_type: 'booking_reminder',
      channel: 'whatsapp',
      subject: null,
      body: 'Reminder: Your booking with [staff_name] is on [date] at [time]. [agency_name]',
    },
    {
      event_type: 'booking_reminder',
      channel: 'email',
      subject: 'Booking reminder — [agency_name]',
      body: 'Hi [client_name],\n\nReminder: Your booking with [staff_name] is on [date] at [time].\n\n[agency_name]',
    },
    {
      event_type: 'booking_cancelled',
      channel: 'whatsapp',
      subject: null,
      body: 'Hi [client_name], your booking on [date] has been cancelled. [agency_name]',
    },
    {
      event_type: 'booking_cancelled',
      channel: 'email',
      subject: 'Booking cancelled — [agency_name]',
      body: 'Hi [client_name],\n\nYour booking with [staff_name] on [date] has been cancelled.\n\n[agency_name]',
    },
    {
      event_type: 'client_approved',
      channel: 'whatsapp',
      subject: null,
      body: 'Hi [client_name], your account at [agency_name] has been approved! You can now browse and book.',
    },
    {
      event_type: 'client_approved',
      channel: 'email',
      subject: 'Account approved — [agency_name]',
      body: 'Dear [client_name],\n\nYour account has been approved. You can now browse and make bookings.\n\nWelcome!\n[agency_name]',
    },
  ];
}

export async function GET(request: NextRequest) {
  if (!validateSuperAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, name, slug, vertical, client_mode, is_active, wizard_completed, subscription_tier, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[super-admin:tenants:list] error:', error);
    return NextResponse.json({ error: 'Failed to load tenants' }, { status: 500 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const enriched = await Promise.all(
    (tenants ?? []).map(async t => {
      const [{ count: staffCount }, { count: bookingCount }] = await Promise.all([
        supabase
          .from('staff')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', t.id),
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', t.id)
          .gte('requested_at', thirtyDaysAgo),
      ]);
      return {
        ...t,
        staff_count: staffCount ?? 0,
        booking_count_30d: bookingCount ?? 0,
      };
    })
  );

  return NextResponse.json({ tenants: enriched });
}

export async function POST(request: NextRequest) {
  if (!validateSuperAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const name: string | undefined = body.name?.trim();
  const slug: string | undefined = body.slug?.trim()?.toLowerCase();
  const vertical = body.vertical;
  const clientMode = body.client_mode;
  const agentEmail: string | undefined = body.agent_email?.trim()?.toLowerCase();
  const agentPassword: string | undefined = body.agent_password;

  if (!name || !slug || !vertical || !clientMode || !agentEmail || !agentPassword) {
    return NextResponse.json(
      { error: 'name, slug, vertical, client_mode, agent_email, agent_password required' },
      { status: 400 }
    );
  }

  if (!/^[a-z0-9-]+$/.test(slug) || slug.length < 3) {
    return NextResponse.json(
      { error: 'slug must be lowercase alphanumeric/hyphen, min 3 chars' },
      { status: 400 }
    );
  }

  if (RESERVED_SLUGS.includes(slug)) {
    return NextResponse.json({ error: 'Slug is reserved' }, { status: 400 });
  }

  if (!isValidVertical(vertical)) {
    return NextResponse.json({ error: 'Invalid vertical' }, { status: 400 });
  }

  if (clientMode !== 'guest' && clientMode !== 'account') {
    return NextResponse.json({ error: 'client_mode must be guest or account' }, { status: 400 });
  }

  if (agentPassword.length < 8) {
    return NextResponse.json({ error: 'agent_password must be at least 8 characters' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 2. Check slug not already taken
  const { data: existing } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
  }

  // 3. Create auth user (tenant_id added in step 5)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: agentEmail,
    password: agentPassword,
    email_confirm: true,
    app_metadata: {
      user_role: 'agent',
    },
  });

  if (authError || !authData?.user) {
    return NextResponse.json({ error: authError?.message ?? 'Failed to create auth user' }, { status: 400 });
  }

  const authUserId = authData.user.id;
  const verticalId = vertical as VerticalId;
  const config = getVerticalConfig(verticalId);

  // Helper: cleanup auth user on any downstream failure
  async function cleanup(reason: string, status = 500) {
    await supabase.auth.admin.deleteUser(authUserId).catch(() => undefined);
    return NextResponse.json({ error: reason }, { status });
  }

  // 4. Insert tenant row
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      name,
      slug,
      vertical: verticalId,
      client_mode: clientMode,
      is_active: true,
      wizard_completed: false,
      wizard_step: 1,
    })
    .select('id')
    .single();

  if (tenantError || !tenant) {
    console.error('[super-admin:tenants:create] tenant insert error:', tenantError);
    return cleanup('Failed to create tenant');
  }

  const tenantId = tenant.id;

  // 5. Update auth user metadata with tenant_id
  await supabase.auth.admin.updateUserById(authUserId, {
    app_metadata: {
      tenant_id: tenantId,
      user_role: 'agent',
    },
  });

  // 6. Insert agent row
  const agentName = agentEmail.split('@')[0];
  const { error: agentError } = await supabase.from('agents').insert({
    tenant_id: tenantId,
    email: agentEmail,
    name: agentName,
  });

  if (agentError) {
    console.error('[super-admin:tenants:create] agent insert error:', agentError);
    await supabase.from('tenants').delete().eq('id', tenantId);
    return cleanup('Failed to create agent');
  }

  // 7. Insert default tenant_settings (vertical defaults)
  const { error: settingsError } = await supabase.from('tenant_settings').insert({
    tenant_id: tenantId,
    agency_display_name: name,
    booking_confirm_mode: config.defaults.booking_confirm_mode,
    default_slot_minutes: config.defaults.default_slot_minutes,
    age_gate_minimum: config.defaults.age_gate_minimum ?? 18,
    require_age_confirm: config.defaults.require_age_confirm,
    pricing_enabled: config.defaults.pricing_enabled,
    client_approval_mode: config.defaults.client_approval_mode,
  });

  if (settingsError) {
    console.error('[super-admin:tenants:create] settings insert error:', settingsError);
    await supabase.from('tenants').delete().eq('id', tenantId);
    return cleanup('Failed to create tenant settings');
  }

  // 8. Insert default notification templates
  const templates = defaultTemplates().map(t => ({
    tenant_id: tenantId,
    event_type: t.event_type,
    channel: t.channel,
    subject: t.subject,
    body: t.body,
    is_active: true,
  }));

  await supabase.from('notification_templates').insert(templates);

  return NextResponse.json({ ok: true, tenantId, slug });
}
