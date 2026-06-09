import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

export async function GET() {
  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: settings } = await supabase
    .from('tenant_settings')
    .select(
      'agency_display_name, logo_url, brand_color, booking_confirm_mode, base_rate_per_30min, currency, min_lead_time_hours, max_booking_days_ahead, age_gate_minimum, require_age_confirm, show_price_to_client, reminder_lead_time_minutes, deposit_pct, deposit_required_above_minutes, pricing_enabled, staff_payout_pct, agency_share_pct, tax_rate_pct, tax_label, tax_period, no_show_revenue_policy, no_show_partial_pct, widget_primary_color, widget_accent_color, widget_bg, widget_bg_custom, widget_font_pair, widget_border_radius, widget_card_style, widget_spacing, widget_text_color, widget_text_muted, widget_surface_color, widget_border_color, widget_show_powered_by, widget_logo_url'
    )
    .eq('tenant_id', user.tenantId)
    .single();

  const { data: lockedRows } = await supabase
    .from('tenant_locked_settings')
    .select('field_name')
    .eq('tenant_id', user.tenantId);

  const lockedFields = (lockedRows ?? []).map(r => r.field_name);

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, slug, vertical, client_mode')
    .eq('id', user.tenantId)
    .single();

  const { data: waIntegration } = await supabase
    .from('tenant_integrations')
    .select('integration_type, is_active')
    .eq('tenant_id', user.tenantId)
    .in('integration_type', ['twilio_whatsapp', 'meta_whatsapp'])
    .eq('is_active', true)
    .maybeSingle();

  return NextResponse.json({
    tenant: tenant ?? null,
    settings: settings ?? null,
    locked_fields: lockedFields,
    integrations: {
      whatsapp: waIntegration
        ? { configured: true, provider: waIntegration.integration_type }
        : { configured: false, provider: null },
    },
  });
}
