import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validateSuperAdminKey } from '@/lib/auth/super-admin';
import type { DefaultSettings, FeatureFlags, SeedTag } from '@/lib/types/tenant-config';

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
      body: 'Hi [client_name],\n\nYour booking with [staff_name] on [date] at [time] ([duration] min) is confirmed.\nServices: [services]\n\nA calendar invite is attached.\n\nThanks,\n[agency_name]',
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
      event_type: 'booking_rescheduled',
      channel: 'whatsapp',
      subject: null,
      body: 'Hi [client_name], your appointment has been rescheduled to [date] at [time] with [staff_name]. See you then! [agency_name]',
    },
    {
      event_type: 'booking_rescheduled',
      channel: 'email',
      subject: 'Appointment rescheduled — [agency_name]',
      body: 'Hi [client_name],\n\nYour appointment has been rescheduled.\n\nNew date: [date] at [time]\nWith: [staff_name]\nServices: [services]\n\nSee you then,\n[agency_name]',
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
    {
      event_type: 'payment_received',
      channel: 'email',
      subject: 'Payment received — [agency_name]',
      body: "Hi [client_name],\n\nWe've received your deposit of [deposit_amount] for your appointment on [date] at [time]. See you soon!\n\n[agency_name]",
    },
    {
      event_type: 'payment_receipt',
      channel: 'email',
      subject: 'Receipt — [agency_name]',
      body: 'Hi [client_name],\n\nThank you — your payment has been received.\n\nDate: [date] [time]\nWith: [staff_name]\nServices: [services]\n\nTotal: [total]\nPaid: [paid_amount] ([payment_method])\n[deposit_line]\n\nThis is a booking receipt, not a tax invoice.\n\n[agency_name]',
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
  // template_slug is the new field; fall back to legacy `vertical` so the
  // existing super-admin console keeps working until the 10A-2 UI swap.
  const templateSlug: string | undefined = (body.template_slug ?? body.vertical)?.trim();
  const agentEmail: string | undefined = body.agent_email?.trim()?.toLowerCase();
  const agentPassword: string | undefined = body.agent_password;
  const businessName: string | undefined = body.business_name?.trim();
  // body.brand_color is intentionally ignored (kept for API back-compat):
  // brand color is chosen in the onboarding wizard's Branding step.
  const clientModeOverride = body.client_mode_override ?? body.client_mode;

  if (!name || !slug || !templateSlug || !agentEmail || !agentPassword) {
    return NextResponse.json(
      { error: 'name, slug, template_slug, agent_email, agent_password required' },
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

  if (clientModeOverride && clientModeOverride !== 'guest' && clientModeOverride !== 'account') {
    return NextResponse.json({ error: 'client_mode_override must be guest or account' }, { status: 400 });
  }

  if (agentPassword.length < 8) {
    return NextResponse.json({ error: 'agent_password must be at least 8 characters' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 1. Resolve the industry template (drives vertical, config, settings, tags).
  const { data: template, error: templateError } = await supabase
    .from('industry_templates')
    .select('*')
    .eq('slug', templateSlug)
    .eq('is_active', true)
    .maybeSingle();

  if (templateError) {
    console.error('[super-admin:tenants:create] template fetch error:', templateError);
    return NextResponse.json({ error: 'Failed to load template' }, { status: 500 });
  }
  if (!template) {
    return NextResponse.json({ error: 'Invalid or inactive template' }, { status: 400 });
  }

  const templateDefaults = template.default_settings as DefaultSettings;
  const templateFlags = template.feature_flags as FeatureFlags;
  const clientMode = clientModeOverride ?? templateDefaults.client_mode;

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
      vertical: template.slug,
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

  // 7. Insert default tenant_settings from the template's default_settings.
  const { error: settingsError } = await supabase.from('tenant_settings').insert({
    tenant_id: tenantId,
    agency_display_name: businessName || name,
    brand_color: '#2BB673',
    booking_confirm_mode: templateDefaults.booking_confirm_mode,
    default_slot_minutes: templateDefaults.default_slot_minutes,
    client_approval_mode: templateDefaults.client_approval_mode,
    deposit_pct: templateDefaults.deposit_pct,
    deposit_required_above_minutes: templateDefaults.deposit_required_above_minutes,
    age_gate_minimum: templateFlags.age_gate_minimum ?? 18,
    require_age_confirm: templateFlags.show_age_gate_step,
    show_price_to_client: templateFlags.show_price_to_client,
  });

  if (settingsError) {
    console.error('[super-admin:tenants:create] settings insert error:', settingsError);
    await supabase.from('tenants').delete().eq('id', tenantId);
    return cleanup('Failed to create tenant settings');
  }

  // 8. Insert tenant_config stamped from the template.
  const { error: configError } = await supabase.from('tenant_config').insert({
    tenant_id: tenantId,
    source_template_slug: template.slug,
    terminology: template.terminology,
    feature_flags: template.feature_flags,
    compliance_flags: template.compliance_flags,
  });

  if (configError) {
    console.error('[super-admin:tenants:create] tenant_config insert error:', configError);
    await supabase.from('tenants').delete().eq('id', tenantId);
    return cleanup('Failed to create tenant config');
  }

  // 9. Seed service_tags from the template.
  const seedTags = (template.seed_tags as SeedTag[]) ?? [];
  if (seedTags.length > 0) {
    const tagRows = seedTags.map((tag, i) => ({
      tenant_id: tenantId,
      name: tag.name,
      description: tag.description ?? null,
      extra_price: 0,
      display_order: i,
    }));
    await supabase.from('service_tags').insert(tagRows);
  }

  // 10. Insert default notification templates
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
