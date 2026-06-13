import { createServiceClient } from '@/lib/supabase/server';

// Shared notification-template resolution + variable interpolation for ALL
// channels (was lib/twilio/dispatch.resolveTemplate, body-only). One
// interpolation implementation so WhatsApp and email always render
// placeholders identically.

export interface ResolvedTemplate {
  body: string;
  /** Interpolated subject — null for channels without one (whatsapp). */
  subject: string | null;
}

/** Replaces [variable] placeholders; unknown placeholders are left as-is. */
export function interpolate(text: string, variables: Record<string, string>): string {
  let out = text;
  for (const [key, value] of Object.entries(variables)) {
    out = out.replace(new RegExp(`\\[${key}\\]`, 'g'), value);
  }
  return out;
}

export async function resolveTemplate(
  tenantId: string,
  eventType: string,
  channel: 'whatsapp' | 'email',
  variables: Record<string, string>
): Promise<ResolvedTemplate | null> {
  const supabase = createServiceClient();

  const { data: template } = await supabase
    .from('notification_templates')
    .select('body, subject')
    .eq('tenant_id', tenantId)
    .eq('event_type', eventType)
    .eq('channel', channel)
    .eq('is_active', true)
    .single();

  if (!template) return null;

  return {
    body: interpolate(template.body, variables),
    subject: template.subject ? interpolate(template.subject, variables) : null,
  };
}
