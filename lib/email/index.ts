import { createServiceClient } from '@/lib/supabase/server';
import type { EmailProvider } from './types';
import { createResendProvider } from './resend';

export type { EmailProvider, SendEmailOptions, SendEmailResult, EmailAttachment } from './types';
export { renderEmailHtml } from './layout';

export interface TenantEmailContext {
  provider: EmailProvider;
  /** From display name: email_sender_name → agency_display_name → tenant name. */
  fromName: string;
  replyTo?: string;
  branding: {
    logoUrl: string | null;
    brandColor: string;
    tenantName: string;
  };
}

/** Slug-safe local part for a from address, e.g. "Velours Demo" → "veloursdemo". */
export function senderLocalPart(name: string | null | undefined): string {
  const cleaned = (name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 30);
  return cleaned || 'bookings';
}

/**
 * Resolves the email send context for a tenant, or null when email is not
 * available. Tenants can self-serve their own Resend key + verified sending
 * domain via the email integration (Phase 19 A5); when present those take
 * priority over the platform env. Falls back to RESEND_API_KEY /
 * EMAIL_FROM_ADDRESS when the tenant hasn't supplied their own. Mirrors
 * getWhatsAppProvider's null-on-unconfigured contract.
 */
export async function getEmailContext(tenantId: string): Promise<TenantEmailContext | null> {
  const supabase = createServiceClient();

  const { data: integration } = await supabase
    .from('tenant_integrations')
    .select('config, is_active')
    .eq('tenant_id', tenantId)
    .eq('integration_type', 'email_resend')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!integration) return null;

  const config = (integration.config ?? {}) as {
    reply_to?: string;
    resend_api_key?: string;
    sending_domain?: string;
  };

  const [{ data: settings }, { data: tenant }] = await Promise.all([
    supabase
      .from('tenant_settings')
      .select('email_sender_name, agency_display_name, logo_url, brand_color')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase.from('tenants').select('name').eq('id', tenantId).maybeSingle(),
  ]);

  const tenantName = tenant?.name ?? 'Book-IT';
  const fromName = settings?.email_sender_name || settings?.agency_display_name || tenantName;

  // Tenant's own key + domain win; otherwise the shared platform credentials.
  const apiKey = config.resend_api_key?.trim() || process.env.RESEND_API_KEY;
  const fromAddress = config.sending_domain?.trim()
    ? `${senderLocalPart(fromName)}@${config.sending_domain.trim()}`
    : process.env.EMAIL_FROM_ADDRESS;

  if (!apiKey || !fromAddress) return null;

  return {
    provider: createResendProvider({ apiKey, fromAddress }),
    fromName,
    ...(config.reply_to ? { replyTo: config.reply_to } : {}),
    branding: {
      logoUrl: settings?.logo_url ?? null,
      brandColor: settings?.brand_color ?? '#2BB673',
      tenantName,
    },
  };
}
