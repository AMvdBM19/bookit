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

/**
 * Resolves the email send context for a tenant, or null when email is not
 * available: platform env unset, no active email_resend integration row, or
 * tenant lookup failure. Mirrors getWhatsAppProvider's null-on-unconfigured
 * contract so dispatch can treat both channels uniformly.
 */
export async function getEmailContext(tenantId: string): Promise<TenantEmailContext | null> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  if (!apiKey || !fromAddress) return null;

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

  const [{ data: settings }, { data: tenant }] = await Promise.all([
    supabase
      .from('tenant_settings')
      .select('email_sender_name, agency_display_name, logo_url, brand_color')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase.from('tenants').select('name').eq('id', tenantId).maybeSingle(),
  ]);

  const tenantName = tenant?.name ?? 'Book-IT';
  const config = (integration.config ?? {}) as { reply_to?: string };

  return {
    provider: createResendProvider({ apiKey, fromAddress }),
    fromName: settings?.email_sender_name || settings?.agency_display_name || tenantName,
    ...(config.reply_to ? { replyTo: config.reply_to } : {}),
    branding: {
      logoUrl: settings?.logo_url ?? null,
      brandColor: settings?.brand_color ?? '#2BB673',
      tenantName,
    },
  };
}
