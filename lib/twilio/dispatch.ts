import { createServiceClient } from '@/lib/supabase/server';

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

async function getTwilioConfig(tenantId: string): Promise<TwilioConfig | null> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('tenant_integrations')
    .select('api_key, is_active')
    .eq('tenant_id', tenantId)
    .eq('integration_type', 'twilio_whatsapp')
    .single();

  if (!data?.is_active || !data?.api_key) return null;

  return { accountSid, authToken, fromNumber: data.api_key };
}

/** @deprecated Use lib/whatsapp/ provider abstraction instead. Kept for resolveTemplate only. */
export async function sendWhatsAppMessage(
  tenantId: string,
  recipientPhone: string,
  messageBody: string
): Promise<boolean> {
  const config = await getTwilioConfig(tenantId);
  if (!config) return false;

  const toNumber = recipientPhone.replace(/[^0-9+]/g, '');
  const from = `whatsapp:${config.fromNumber}`;
  const to = `whatsapp:${toNumber}`;

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
    const credentials = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: from, To: to, Body: messageBody }).toString(),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[twilio] Send failed:', err);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[twilio] Network error:', err);
    return false;
  }
}

export async function resolveTemplate(
  tenantId: string,
  eventType: string,
  channel: 'whatsapp' | 'email',
  variables: Record<string, string>
): Promise<string | null> {
  const supabase = createServiceClient();

  const { data: template } = await supabase
    .from('notification_templates')
    .select('body')
    .eq('tenant_id', tenantId)
    .eq('event_type', eventType)
    .eq('channel', channel)
    .eq('is_active', true)
    .single();

  if (!template) return null;

  let body = template.body;
  for (const [key, value] of Object.entries(variables)) {
    body = body.replace(new RegExp(`\\[${key}\\]`, 'g'), value);
  }
  return body;
}
