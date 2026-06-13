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
  // Pricing & finances (Phase 10B-1). Tax fields (rate, label, period) are
  // wizard-locked and fully read-only since Phase 16-A — not listed here so
  // the allowlist and lock enforcement agree. The revenue split stays listed
  // because its lock is per-tenant row-driven and the UI hides editing when
  // locked; currency + base_rate_per_30min are tenant-editable (14-A9).
  'currency',
  'base_rate_per_30min',
  'pricing_enabled',
  'staff_payout_pct',
  'agency_share_pct',
  'no_show_revenue_policy',
  'no_show_partial_pct',
  // Per-service duration + buffer time (Tier 1 polish sprint).
  'per_service_duration_enabled',
  'buffer_before_minutes',
  'buffer_after_minutes',
  // Widget customizer (Phase 12A) — always editable, never lockable.
  'widget_primary_color',
  'widget_accent_color',
  'widget_bg',
  'widget_bg_custom',
  'widget_font_pair',
  'widget_border_radius',
  'widget_card_style',
  'widget_spacing',
  'widget_text_color',
  'widget_text_muted',
  'widget_surface_color',
  'widget_border_color',
  'widget_show_powered_by',
  'widget_logo_url',
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

  // Currency: ISO 4217-style three-letter code.
  if ('currency' in update) {
    const currency = String(update.currency ?? '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      return NextResponse.json(
        { error: 'currency must be a three-letter code (e.g. EUR)' },
        { status: 400 }
      );
    }
    update.currency = currency;
  }

  // Base rate: non-negative number. Affects future bookings only —
  // historical booking amounts are never recalculated.
  if ('base_rate_per_30min' in update) {
    const rate = Number(update.base_rate_per_30min);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100000) {
      return NextResponse.json(
        { error: 'base_rate_per_30min must be a non-negative number' },
        { status: 400 }
      );
    }
    update.base_rate_per_30min = rate;
  }

  // Buffer minutes: 0–60 in whole minutes.
  for (const bufferField of ['buffer_before_minutes', 'buffer_after_minutes'] as const) {
    if (bufferField in update) {
      const minutes = Number(update[bufferField]);
      if (!Number.isInteger(minutes) || minutes < 0 || minutes > 60) {
        return NextResponse.json(
          { error: `${bufferField} must be an integer between 0 and 60` },
          { status: 400 }
        );
      }
      update[bufferField] = minutes;
    }
  }

  // Saving any customizer field marks the "Customize widget" onboarding
  // step complete (Phase 15-A3).
  if (Object.keys(update).some(f => f.startsWith('widget_'))) {
    update.widget_customized_at = new Date().toISOString();
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
