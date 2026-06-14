import type {
  PaymentProvider,
  CreatePaymentInput,
  CreatedPayment,
  FetchedPayment,
  PaymentStatus,
} from './types';

// Mollie adapter using the REST API v2 directly (no SDK). Auth is a per-call
// Bearer token (tenant key or platform fallback, resolved by the factory).
// Mollie amounts are strings with exactly 2 decimals in an { currency, value }
// object.

const MOLLIE_API = 'https://api.mollie.com/v2';

// Mollie payment statuses → our normalized set.
function normalizeStatus(s: string): PaymentStatus {
  switch (s) {
    case 'paid':
      return 'paid';
    case 'failed':
      return 'failed';
    case 'expired':
      return 'expired';
    case 'canceled':
      return 'cancelled';
    case 'refunded':
      return 'refunded';
    case 'open':
    case 'pending':
    case 'authorized':
    default:
      return 'pending';
  }
}

interface MollieAmount {
  currency: string;
  value: string;
}

interface MolliePayment {
  id: string;
  status: string;
  method: string | null;
  paidAt?: string;
  amount?: MollieAmount;
  metadata?: Record<string, string> | null;
  _links?: { checkout?: { href: string } };
}

export function createMollieProvider(apiKey: string): PaymentProvider {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  return {
    async createPayment(input: CreatePaymentInput): Promise<CreatedPayment | null> {
      try {
        const res = await fetch(`${MOLLIE_API}/payments`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            amount: { currency: input.currency || 'EUR', value: input.amount.toFixed(2) },
            description: input.description,
            redirectUrl: input.redirectUrl,
            webhookUrl: input.webhookUrl,
            ...(input.method ? { method: input.method } : {}),
            ...(input.metadata ? { metadata: input.metadata } : {}),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as MolliePayment & { detail?: string };
        if (!res.ok) {
          console.error('[mollie] createPayment failed:', res.status, data.detail ?? data);
          return null;
        }
        return {
          id: data.id,
          checkoutUrl: data._links?.checkout?.href ?? null,
          status: normalizeStatus(data.status),
        };
      } catch (err) {
        console.error('[mollie] createPayment network error:', err);
        return null;
      }
    },

    async getPayment(id: string): Promise<FetchedPayment | null> {
      try {
        const res = await fetch(`${MOLLIE_API}/payments/${encodeURIComponent(id)}`, { headers });
        const data = (await res.json().catch(() => ({}))) as MolliePayment & { detail?: string };
        if (!res.ok) {
          console.error('[mollie] getPayment failed:', res.status, data.detail ?? data);
          return null;
        }
        return {
          id: data.id,
          status: normalizeStatus(data.status),
          method: data.method ?? null,
          paidAt: data.paidAt ?? null,
          amount: data.amount ? Number(data.amount.value) : null,
          currency: data.amount?.currency ?? null,
          metadata: data.metadata ?? null,
        };
      } catch (err) {
        console.error('[mollie] getPayment network error:', err);
        return null;
      }
    },
  };
}
