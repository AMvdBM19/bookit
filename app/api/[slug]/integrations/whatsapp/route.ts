import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

const WA_TYPES = ['twilio_whatsapp', 'meta_whatsapp'] as const;
type WaType = (typeof WA_TYPES)[number];

function maskTail(value: string | null | undefined, visible = 4): string | null {
  if (!value) return null;
  if (value.length <= visible) return '•'.repeat(value.length);
  return '•'.repeat(Math.max(3, value.length - visible)) + value.slice(-visible);
}

// GET — current WhatsApp integration state for the tenant (agent-only).
// Stored values are masked; full values are never returned.
export async function GET() {
  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: row } = await supabase
    .from('tenant_integrations')
    .select('integration_type, api_key, config, is_active, updated_at')
    .eq('tenant_id', user.tenantId)
    .in('integration_type', [...WA_TYPES])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ configured: false, provider: null, is_active: false, config: {} });
  }

  const config = (row.config ?? {}) as Record<string, string>;

  return NextResponse.json({
    configured: true,
    provider: row.integration_type,
    is_active: row.is_active === true,
    config:
      row.integration_type === 'twilio_whatsapp'
        ? { from_number: maskTail(row.api_key) }
        : {
            phone_number_id: maskTail(config.phone_number_id),
            waba_id: maskTail(config.waba_id),
          },
  });
}

// PUT — upsert the tenant's WhatsApp integration (agent-only).
// Global auth tokens (Twilio account SID/token, Meta access token) live in
// platform env vars and are intentionally NOT accepted here.
export async function PUT(request: NextRequest) {
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

  const provider = body.provider as WaType;
  if (!WA_TYPES.includes(provider)) {
    return NextResponse.json(
      { error: 'provider must be twilio_whatsapp or meta_whatsapp' },
      { status: 400 }
    );
  }
  const isActive = body.is_active !== false;

  let apiKey: string | null = null;
  let config: Record<string, string> = {};

  if (provider === 'twilio_whatsapp') {
    const fromNumber = typeof body.from_number === 'string' ? body.from_number.trim() : '';
    if (!/^\+[1-9]\d{6,14}$/.test(fromNumber)) {
      return NextResponse.json(
        { error: 'from_number must be in international format, e.g. +31612345678' },
        { status: 400 }
      );
    }
    // The dispatch factory reads the Twilio from-number from api_key.
    apiKey = fromNumber;
  } else {
    const phoneNumberId = typeof body.phone_number_id === 'string' ? body.phone_number_id.trim() : '';
    if (!/^\d{5,30}$/.test(phoneNumberId)) {
      return NextResponse.json(
        { error: 'phone_number_id must be the numeric ID from Meta Business Manager' },
        { status: 400 }
      );
    }
    const wabaId = typeof body.waba_id === 'string' ? body.waba_id.trim() : '';
    if (wabaId && !/^\d{5,30}$/.test(wabaId)) {
      return NextResponse.json({ error: 'waba_id must be numeric' }, { status: 400 });
    }
    config = { phone_number_id: phoneNumberId, ...(wabaId ? { waba_id: wabaId } : {}) };
  }

  const supabase = createServiceClient();

  // One WhatsApp integration per tenant: replace any existing WA rows so the
  // dispatch factory's single-row lookup stays unambiguous.
  const { error: delError } = await supabase
    .from('tenant_integrations')
    .delete()
    .eq('tenant_id', user.tenantId)
    .in('integration_type', [...WA_TYPES]);

  if (delError) {
    console.error('[integrations:whatsapp] delete error:', delError);
    return NextResponse.json({ error: 'Failed to save integration' }, { status: 500 });
  }

  const { error: insError } = await supabase.from('tenant_integrations').insert({
    tenant_id: user.tenantId,
    integration_type: provider,
    api_key: apiKey,
    config,
    is_active: isActive,
    updated_at: new Date().toISOString(),
  });

  if (insError) {
    console.error('[integrations:whatsapp] insert error:', insError);
    return NextResponse.json({ error: 'Failed to save integration' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, provider, is_active: isActive });
}
