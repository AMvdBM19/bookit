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

  // select('*') keeps this resilient to additive columns (per-service duration,
  // buffers) that may not exist until migrations run.
  const { data: settings } = await supabase
    .from('tenant_settings')
    .select('*')
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

  const { data: emailIntegration } = await supabase
    .from('tenant_integrations')
    .select('is_active')
    .eq('tenant_id', user.tenantId)
    .eq('integration_type', 'email_resend')
    .eq('is_active', true)
    .maybeSingle();

  const { data: mollieIntegration } = await supabase
    .from('tenant_integrations')
    .select('is_active, config')
    .eq('tenant_id', user.tenantId)
    .eq('integration_type', 'mollie')
    .eq('is_active', true)
    .maybeSingle();

  const mollieKey = ((mollieIntegration?.config ?? {}) as { api_key?: string }).api_key;
  const mollieMode = mollieKey?.startsWith('test_')
    ? 'test'
    : mollieKey?.startsWith('live_')
      ? 'live'
      : null;

  return NextResponse.json({
    tenant: tenant ?? null,
    settings: settings ?? null,
    locked_fields: lockedFields,
    integrations: {
      whatsapp: waIntegration
        ? { configured: true, provider: waIntegration.integration_type }
        : { configured: false, provider: null },
      email: { configured: !!emailIntegration },
      mollie: { configured: !!mollieIntegration, mode: mollieMode },
    },
  });
}
