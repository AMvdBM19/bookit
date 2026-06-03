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
      'agency_display_name, logo_url, booking_confirm_mode, base_rate_per_30min, currency, min_lead_time_hours, max_booking_days_ahead, age_gate_minimum, require_age_confirm'
    )
    .eq('tenant_id', user.tenantId)
    .single();

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
    integrations: {
      whatsapp: waIntegration
        ? { configured: true, provider: waIntegration.integration_type }
        : { configured: false, provider: null },
    },
  });
}
