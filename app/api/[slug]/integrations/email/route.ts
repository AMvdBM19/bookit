import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

// Tenant email integration (Resend channel) — Phase 16-B2. Mirrors the
// WhatsApp integration route: platform credentials (RESEND_API_KEY, the
// sending address) live in env and are never accepted or returned here;
// the tenant only controls activation, sender display name and reply-to.

const INTEGRATION_TYPE = 'email_resend';

function maskEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const at = value.indexOf('@');
  if (at <= 1) return '•••' + value.slice(at);
  return value[0] + '•'.repeat(Math.max(3, at - 1)) + value.slice(at);
}

// GET — current email integration state (agent-only). reply_to is masked.
export async function GET() {
  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const [{ data: row }, { data: settings }] = await Promise.all([
    supabase
      .from('tenant_integrations')
      .select('config, is_active, updated_at')
      .eq('tenant_id', user.tenantId)
      .eq('integration_type', INTEGRATION_TYPE)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('tenant_settings')
      .select('email_sender_name, agency_display_name')
      .eq('tenant_id', user.tenantId)
      .maybeSingle(),
  ]);

  const config = (row?.config ?? {}) as { reply_to?: string };

  return NextResponse.json({
    configured: !!row,
    is_active: row?.is_active === true,
    config: { reply_to: maskEmail(config.reply_to) },
    sender_name: settings?.email_sender_name ?? null,
    sender_name_fallback: settings?.agency_display_name ?? null,
  });
}

// PUT — upsert the tenant's email integration (agent-only).
// Body: { is_active?: boolean, reply_to?: string, sender_name?: string }
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

  const replyTo = typeof body.reply_to === 'string' ? body.reply_to.trim() : '';
  if (replyTo && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo) || replyTo.length > 254)) {
    return NextResponse.json(
      { error: 'reply_to must be a valid email address' },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // Sender display name lives on tenant_settings (email_sender_name,
  // consumed by the From header). Empty string clears it.
  if ('sender_name' in body) {
    const senderName =
      typeof body.sender_name === 'string' ? body.sender_name.trim().slice(0, 80) : '';
    const { error: nameError } = await supabase
      .from('tenant_settings')
      .update({
        email_sender_name: senderName || null,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', user.tenantId);
    if (nameError) {
      console.error('[integrations:email] sender name error:', nameError);
      return NextResponse.json({ error: 'Failed to save sender name' }, { status: 500 });
    }
  }

  // One email integration per tenant: replace existing rows (same rule as
  // WhatsApp) so the dispatch lookup stays single-row.
  const { error: delError } = await supabase
    .from('tenant_integrations')
    .delete()
    .eq('tenant_id', user.tenantId)
    .eq('integration_type', INTEGRATION_TYPE);

  if (delError) {
    console.error('[integrations:email] delete error:', delError);
    return NextResponse.json({ error: 'Failed to save integration' }, { status: 500 });
  }

  const { error: insError } = await supabase.from('tenant_integrations').insert({
    tenant_id: user.tenantId,
    integration_type: INTEGRATION_TYPE,
    api_key: null,
    config: replyTo ? { reply_to: replyTo } : {},
    is_active: isActive,
    updated_at: new Date().toISOString(),
  });

  if (insError) {
    console.error('[integrations:email] insert error:', insError);
    return NextResponse.json({ error: 'Failed to save integration' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, is_active: isActive });
}
