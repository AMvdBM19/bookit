import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import type { FeatureFlags } from '@/lib/types/tenant-config';
import { DEFAULT_FEATURE_FLAGS } from '@/lib/types/tenant-config';

const EDITABLE_FIELDS = [
  'agency_display_name',
  'logo_url',
  'brand_color',
  'booking_confirm_mode',
  'min_lead_time_hours',
  'max_booking_days_ahead',
  'show_price_to_client',
  'reminder_lead_time_minutes',
  'require_age_confirm',
  'deposit_pct',
  'deposit_required_above_minutes',
  // Pricing & finances (Phase 10B-1). currency, base_rate_per_30min and
  // tax_rate_pct are intentionally excluded — they are locked after the wizard.
  'pricing_enabled',
  'staff_payout_pct',
  'agency_share_pct',
  'tax_label',
  'tax_period',
  'no_show_revenue_policy',
  'no_show_partial_pct',
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

const DEPOSIT_FIELDS: EditableField[] = ['deposit_pct', 'deposit_required_above_minutes'];

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

  const supabase = createServiceClient();

  // Resolve tenant config to check whether deposits are supported.
  const { data: tenantConfig } = await supabase
    .from('tenant_config')
    .select('feature_flags')
    .eq('tenant_id', user.tenantId)
    .maybeSingle();

  const featureFlags = (tenantConfig?.feature_flags as FeatureFlags | undefined) ?? DEFAULT_FEATURE_FLAGS;

  // Build the candidate update, filtering to editable fields only
  const update: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (!(field in body)) continue;

    // Reject deposit fields for templates that don't support them
    if (DEPOSIT_FIELDS.includes(field) && !featureFlags.deposits_supported) {
      return NextResponse.json(
        { error: `Field not available for this template: ${field}` },
        { status: 400 }
      );
    }

    update[field] = body[field];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 });
  }

  // Fetch locked fields fresh — no cache
  const { data: lockedRows } = await supabase
    .from('tenant_locked_settings')
    .select('field_name')
    .eq('tenant_id', user.tenantId);

  const lockedSet = new Set((lockedRows ?? []).map(r => r.field_name));

  for (const field of Object.keys(update)) {
    if (lockedSet.has(field)) {
      return NextResponse.json({ error: `Field is locked: ${field}` }, { status: 403 });
    }
  }

  update.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('tenant_settings')
    .update(update)
    .eq('tenant_id', user.tenantId);

  if (error) {
    console.error('[settings:patch] error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
