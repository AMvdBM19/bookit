import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

// Tenant email integration (Resend channel). Tenants can self-serve their own
// Resend API key + verified sending domain (Phase 19 A5); when set those are
// used by getEmailContext instead of the shared platform credentials. The key
// is stored in config.resend_api_key and never returned in full.

const INTEGRATION_TYPE = 'email_resend';

function maskEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const at = value.indexOf('@');
  if (at <= 1) return '•••' + value.slice(at);
  return value[0] + '•'.repeat(Math.max(3, at - 1)) + value.slice(at);
}

function maskKey(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 6) return '••••••';
  return value.slice(0, 3) + '•'.repeat(8) + value.slice(-4);
}

// Best-effort Resend domain verification lookup. Returns the domain's status
// ('verified' | 'pending' | etc.) or null when it can't be determined.
async function fetchDomainStatus(apiKey: string, domain: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as {
      data?: Array<{ name?: string; status?: string }>;
    };
    const match = (data.data ?? []).find(d => d.name?.toLowerCase() === domain.toLowerCase());
    return match?.status ?? 'not_found';
  } catch {
    return null;
  }
}

// GET — current email integration state (agent-only). Secrets are masked.
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

  const config = (row?.config ?? {}) as {
    reply_to?: string;
    resend_api_key?: string;
    sending_domain?: string;
  };

  // Resolve verification status when the tenant supplied their own key+domain.
  let domainStatus: string | null = null;
  if (config.resend_api_key && config.sending_domain) {
    domainStatus = await fetchDomainStatus(config.resend_api_key, config.sending_domain);
  }

  return NextResponse.json({
    configured: !!row,
    is_active: row?.is_active === true,
    config: {
      reply_to: maskEmail(config.reply_to),
      resend_api_key: maskKey(config.resend_api_key),
      sending_domain: config.sending_domain ?? null,
    },
    has_own_key: !!config.resend_api_key,
    domain_status: domainStatus,
    sender_name: settings?.email_sender_name ?? null,
    sender_name_fallback: settings?.agency_display_name ?? null,
  });
}

// PUT — upsert the tenant's email integration (agent-only).
// Body: { is_active?, reply_to?, sender_name?, resend_api_key?, sending_domain? }
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

  const sendingDomain =
    typeof body.sending_domain === 'string' ? body.sending_domain.trim().toLowerCase() : '';
  if (sendingDomain && (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(sendingDomain) || sendingDomain.length > 253)) {
    return NextResponse.json(
      { error: 'sending_domain must be a valid domain (e.g. mail.example.com)' },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // Preserve the stored key unless the client sends a new (non-masked) one.
  const { data: existing } = await supabase
    .from('tenant_integrations')
    .select('config')
    .eq('tenant_id', user.tenantId)
    .eq('integration_type', INTEGRATION_TYPE)
    .limit(1)
    .maybeSingle();
  const existingConfig = (existing?.config ?? {}) as {
    resend_api_key?: string;
    sending_domain?: string;
  };

  const submittedKey = typeof body.resend_api_key === 'string' ? body.resend_api_key.trim() : '';
  // A masked value (contains a bullet) means "unchanged" — keep the stored key.
  const keepExistingKey = submittedKey === '' || submittedKey.includes('•');
  const resendApiKey = keepExistingKey ? existingConfig.resend_api_key : submittedKey;
  if (resendApiKey && !/^re_[A-Za-z0-9_-]{10,}$/.test(resendApiKey)) {
    return NextResponse.json(
      { error: 'Resend API key looks invalid (expected re_…)' },
      { status: 400 }
    );
  }

  // Sender display name lives on tenant_settings (email_sender_name).
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

  // One email integration per tenant: replace existing rows so the dispatch
  // lookup stays single-row.
  const { error: delError } = await supabase
    .from('tenant_integrations')
    .delete()
    .eq('tenant_id', user.tenantId)
    .eq('integration_type', INTEGRATION_TYPE);

  if (delError) {
    console.error('[integrations:email] delete error:', delError);
    return NextResponse.json({ error: 'Failed to save integration' }, { status: 500 });
  }

  const config: Record<string, string> = {};
  if (replyTo) config.reply_to = replyTo;
  if (resendApiKey) config.resend_api_key = resendApiKey;
  if (sendingDomain) config.sending_domain = sendingDomain;

  const { error: insError } = await supabase.from('tenant_integrations').insert({
    tenant_id: user.tenantId,
    integration_type: INTEGRATION_TYPE,
    api_key: null,
    config,
    is_active: isActive,
    updated_at: new Date().toISOString(),
  });

  if (insError) {
    console.error('[integrations:email] insert error:', insError);
    return NextResponse.json({ error: 'Failed to save integration' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, is_active: isActive });
}
