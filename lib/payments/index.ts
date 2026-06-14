import { createServiceClient } from '@/lib/supabase/server';
import type { PaymentProvider } from './types';
import { createMollieProvider } from './mollie';

export type {
  PaymentProvider,
  CreatePaymentInput,
  CreatedPayment,
  FetchedPayment,
  PaymentStatus,
} from './types';

/**
 * Resolve a payment provider for a tenant, or null when payments are not
 * available. Order: the tenant's own Mollie key (config.api_key on an active
 * `mollie` integration) wins; otherwise the platform-wide MOLLIE_API_KEY env
 * is used IF the tenant has an active Mollie integration row (opt-in). No
 * active row → null (payments disabled for that tenant).
 */
export async function getPaymentProvider(tenantId: string): Promise<PaymentProvider | null> {
  const supabase = createServiceClient();

  const { data: integration } = await supabase
    .from('tenant_integrations')
    .select('config, is_active')
    .eq('tenant_id', tenantId)
    .eq('integration_type', 'mollie')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!integration) return null;

  const config = (integration.config ?? {}) as { api_key?: string };
  const apiKey = config.api_key || process.env.MOLLIE_API_KEY;
  if (!apiKey) return null;

  return createMollieProvider(apiKey);
}
