import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

// Tenant Mollie integration (Phase 17-B4). Mirrors the WhatsApp/email
// integration routes: single `mollie` row per tenant, config.api_key JSONB,
// is_active, masked GET. The key is the tenant's own Mollie API key; the
// platform-wide MOLLIE_API_KEY env is the fallback when none is set here.

const INTEGRATION_TYPE = 'mollie';

function maskKey(key: string | null | undefined): string | null {
  if (!key) return null;
  // Keep the test_/live_ prefix and last 4 chars: live_••••••••abcd
  const prefixMatch = key.match(/^(test_|live_)/);
  const prefix = prefixMatch ? prefixMatch[1] : '';
  const tail = key.slice(-4);
  return `${prefix}${'•'.repeat(8)}${tail}`;
}

function keyMode(key: string | null | undefined): 'test' | 'live' | null {
  if (!key) return null;
  if (key.startsWith('test_')) return 'test';
  if (key.startsWith('live_')) return 'live';
  return null;
}

// GET — current Mollie integration state (agent-only). Key masked.
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
    .select('config, is_active')
    .eq('tenant_id', user.tenantId)
    .eq('integration_type', INTEGRATION_TYPE)
    .limit(1)
    .maybeSingle();

  const config = (row?.config ?? {}) as { api_key?: string };

  return NextResponse.json({
    configured: !!row,
    is_active: row?.is_active === true,
    masked_key: maskKey(config.api_key),
    mode: keyMode(config.api_key),
    // True when no tenant key is set but the platform env key exists, so the
    // UI can explain the shared-account fallback.
    platform_fallback: !config.api_key && !!process.env.MOLLIE_API_KEY,
  });
}

// PUT — upsert the tenant's Mollie integration (agent-only).
// Body: { api_key?: string, is_active?: boolean }. An omitted/blank api_key
// keeps the previously stored key (so toggling Active doesn't wipe it).
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

  const isActive = body.is_active !== false;
  const supabase = createServiceClient();

  // Load any existing key so a blank submit (e.g. just toggling Active) keeps it.
  const { data: existing } = await supabase
    .from('tenant_integrations')
    .select('config')
    .eq('tenant_id', user.tenantId)
    .eq('integration_type', INTEGRATION_TYPE)
    .limit(1)
    .maybeSingle();
  const existingKey = ((existing?.config ?? {}) as { api_key?: string }).api_key;

  let apiKey = existingKey;
  if (typeof body.api_key === 'string' && body.api_key.trim() !== '') {
    const candidate = body.api_key.trim();
    if (!/^(test_|live_)[A-Za-z0-9]{25,}$/.test(candidate)) {
      return NextResponse.json(
        { error: 'API key must start with test_ or live_ and be at least 30 characters' },
        { status: 400 }
      );
    }
    apiKey = candidate;
  }

  // Single Mollie row per tenant: replace existing (same rule as WhatsApp/email).
  const { error: delError } = await supabase
    .from('tenant_integrations')
    .delete()
    .eq('tenant_id', user.tenantId)
    .eq('integration_type', INTEGRATION_TYPE);
  if (delError) {
    console.error('[integrations:mollie] delete error:', delError);
    return NextResponse.json({ error: 'Failed to save integration' }, { status: 500 });
  }

  const { error: insError } = await supabase.from('tenant_integrations').insert({
    tenant_id: user.tenantId,
    integration_type: INTEGRATION_TYPE,
    api_key: null,
    config: apiKey ? { api_key: apiKey } : {},
    is_active: isActive,
    updated_at: new Date().toISOString(),
  });
  if (insError) {
    console.error('[integrations:mollie] insert error:', insError);
    return NextResponse.json({ error: 'Failed to save integration' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, is_active: isActive, mode: keyMode(apiKey) });
}
