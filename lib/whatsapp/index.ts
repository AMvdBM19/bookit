import { createServiceClient } from '@/lib/supabase/server';
import type { WhatsAppProvider, WhatsAppProviderType } from './types';
import { createTwilioProvider } from './twilio';
import { createMetaProvider } from './meta';

export type { WhatsAppProvider, WhatsAppProviderType };

export async function getWhatsAppProvider(tenantId: string): Promise<WhatsAppProvider | null> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('tenant_integrations')
    .select('integration_type, api_key, config, is_active')
    .eq('tenant_id', tenantId)
    .in('integration_type', ['twilio_whatsapp', 'meta_whatsapp'])
    .eq('is_active', true)
    .limit(1)
    .single();

  if (!data) return null;

  const providerType = data.integration_type as WhatsAppProviderType;
  const providerConfig = (data.config ?? {}) as Record<string, string>;

  if (providerType === 'twilio_whatsapp') {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken || !data.api_key) return null;

    return createTwilioProvider({
      accountSid,
      authToken,
      fromNumber: data.api_key,
    });
  }

  if (providerType === 'meta_whatsapp') {
    const accessToken = process.env.META_WA_ACCESS_TOKEN;
    const phoneNumberId = providerConfig.phone_number_id || process.env.META_WA_PHONE_NUMBER_ID;
    if (!accessToken || !phoneNumberId) return null;

    return createMetaProvider({
      accessToken,
      phoneNumberId,
    });
  }

  return null;
}
