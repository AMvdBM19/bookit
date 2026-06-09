import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

const LOCKED_FIELDS = [
  'currency',
  'staff_payout_pct',
  'agency_share_pct',
  'tax_rate_pct',
  'tax_label',
  'age_gate_minimum',
  'gdpr_retention_years',
];

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
  if (!body) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const tenantId = user.tenantId;

  // 1. UPSERT tenant_settings
  const agency_share_pct = Math.max(0, 100 - (Number(body.staff_payout_pct) || 70));
  const { error: settingsError } = await supabase
    .from('tenant_settings')
    .upsert({
      tenant_id: tenantId,
      agency_display_name: body.agency_display_name || null,
      brand_color: body.brand_color || '#2BB673',
      logo_url: body.logo_url || null,
      default_slot_minutes: Number(body.default_slot_minutes) || 30,
      min_lead_time_hours: Number(body.min_lead_time_hours) || 2,
      booking_confirm_mode: body.booking_confirm_mode || 'staff_must_accept',
      base_rate_per_30min: Number(body.base_rate_per_30min) || 60,
      staff_payout_pct: Number(body.staff_payout_pct) || 70,
      agency_share_pct,
      currency: body.currency || 'EUR',
      tax_rate_pct: Number(body.tax_rate_pct) || 21,
      tax_label: body.tax_label || 'BTW',
      age_gate_minimum: Number(body.age_gate_minimum) || 18,
      require_age_confirm: body.require_age_confirm ?? true,
      require_id_upload: body.require_id_upload ?? false,
    });

  if (settingsError) {
    console.error('tenant_settings upsert error:', settingsError);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }

  // 1b. Persist the chosen booking_mode into tenant_config feature_flags
  const bookingMode =
    body.booking_mode === 'pool' || body.booking_mode === 'staff_select'
      ? body.booking_mode
      : 'staff_select';

  const { data: existingConfig } = await supabase
    .from('tenant_config')
    .select('feature_flags')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (existingConfig) {
    const updatedFlags = {
      ...(existingConfig.feature_flags as Record<string, unknown>),
      booking_mode: bookingMode,
    };
    const { error: configError } = await supabase
      .from('tenant_config')
      .update({ feature_flags: updatedFlags, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId);

    if (configError) {
      console.error('tenant_config booking_mode update error:', configError);
      return NextResponse.json({ error: 'Failed to save booking mode' }, { status: 500 });
    }
  }

  // 2. Update tenants with identity fields
  const tenantUpdate: Record<string, unknown> = {};
  if (body.kvk_number) tenantUpdate.kvk_number = body.kvk_number;
  if (body.license_number) tenantUpdate.license_number = body.license_number;

  if (Object.keys(tenantUpdate).length > 0) {
    const { error: tenantFieldError } = await supabase
      .from('tenants')
      .update(tenantUpdate)
      .eq('id', tenantId);

    if (tenantFieldError) {
      console.error('tenants identity update error:', tenantFieldError);
      return NextResponse.json({ error: 'Failed to update tenant' }, { status: 500 });
    }
  }

  // 3. Seed service_tags if none exist for this tenant
  const tags: string[] = Array.isArray(body.service_tags) ? body.service_tags : [];
  if (tags.length > 0) {
    const { count } = await supabase
      .from('service_tags')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    if (!count) {
      const tagRows = tags.map((name: string, i: number) => ({
        tenant_id: tenantId,
        name,
        extra_price: 0,
        display_order: i,
      }));
      await supabase.from('service_tags').insert(tagRows);
    }
  }

  // 4. Mark wizard complete
  const { error: wizardError } = await supabase
    .from('tenants')
    .update({ wizard_completed: true, wizard_step: 7 })
    .eq('id', tenantId);

  if (wizardError) {
    console.error('wizard_completed update error:', wizardError);
    return NextResponse.json({ error: 'Failed to complete wizard' }, { status: 500 });
  }

  // 5. Lock financial settings
  const lockRows = LOCKED_FIELDS.map(field_name => ({
    tenant_id: tenantId,
    field_name,
    locked_by: 'wizard',
  }));

  await supabase
    .from('tenant_locked_settings')
    .upsert(lockRows, { onConflict: 'tenant_id,field_name' });

  return NextResponse.json({ ok: true, redirect: `/${slug}/dashboard` });
}
