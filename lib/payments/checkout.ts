import type { SupabaseClient } from '@supabase/supabase-js';
import { getPaymentProvider } from './index';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.bookit.monoliet.cloud';

export interface DepositCheckoutResult {
  checkoutUrl: string;
  depositAmount: number;
  /** Human-readable amount for message templates, e.g. "€20.00". */
  depositFormatted: string;
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency: currency || 'EUR' }).format(amount);
  } catch {
    return `${currency || 'EUR'} ${amount.toFixed(2)}`;
  }
}

/**
 * Create a Mollie deposit checkout for a freshly-confirmed booking, when all
 * hold: deposit_required, deposit_amount > 0, and the tenant has an active
 * Mollie integration. Inserts a `payments` row and flips
 * bookings.payment_status to 'deposit_pending'. Returns the checkout URL +
 * amount, or null when no deposit applies / payments aren't configured /
 * provider creation fails. Never throws — payment is a follow-up, never
 * blocks confirmation.
 *
 * Idempotent-ish: skips if the booking already has a pending/paid deposit
 * payment row, so re-confirming (or multiple confirm paths) won't double-charge.
 */
export async function createDepositCheckout(
  supabase: SupabaseClient,
  tenantId: string,
  slug: string,
  bookingId: string
): Promise<DepositCheckoutResult | null> {
  try {
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, deposit_required, deposit_amount, deposit_paid, payment_status')
      .eq('id', bookingId)
      .eq('tenant_id', tenantId)
      .single();

    if (!booking) return null;
    const depositAmount = Number(booking.deposit_amount ?? 0);
    if (!booking.deposit_required || !(depositAmount > 0)) return null;
    if (booking.deposit_paid) return null;

    // Don't create a second checkout if one is already pending/paid.
    const { data: existing } = await supabase
      .from('payments')
      .select('id, status, checkout_url')
      .eq('booking_id', bookingId)
      .eq('payment_type', 'deposit')
      .in('status', ['pending', 'paid'])
      .limit(1)
      .maybeSingle();
    const provider = await getPaymentProvider(tenantId);
    if (!provider) return null;

    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single();
    const { data: settings } = await supabase
      .from('tenant_settings')
      .select('currency')
      .eq('tenant_id', tenantId)
      .single();

    const currency = settings?.currency ?? 'EUR';

    if (existing?.checkout_url && existing.status === 'pending') {
      return {
        checkoutUrl: existing.checkout_url,
        depositAmount,
        depositFormatted: formatMoney(depositAmount, currency),
      };
    }
    if (existing) return null; // already paid — nothing to do

    const shortId = bookingId.slice(0, 8);

    const created = await provider.createPayment({
      amount: depositAmount,
      currency,
      description: `Deposit — ${tenant?.name ?? 'Booking'} booking ${shortId}`,
      redirectUrl: `${APP_URL}/book/${slug}/payment/success?booking_id=${bookingId}`,
      webhookUrl: `${APP_URL}/book/${slug}/api/payments/webhook`,
      metadata: { booking_id: bookingId, tenant_id: tenantId, payment_type: 'deposit' },
    });

    if (!created || !created.checkoutUrl) return null;

    await supabase.from('payments').insert({
      booking_id: bookingId,
      tenant_id: tenantId,
      amount: depositAmount,
      currency,
      payment_type: 'deposit',
      status: created.status,
      provider: 'mollie',
      provider_payment_id: created.id,
      checkout_url: created.checkoutUrl,
    });

    await supabase
      .from('bookings')
      .update({ payment_status: 'deposit_pending' })
      .eq('id', bookingId)
      .eq('tenant_id', tenantId);

    return {
      checkoutUrl: created.checkoutUrl,
      depositAmount,
      depositFormatted: formatMoney(depositAmount, currency),
    };
  } catch (err) {
    console.error('[payments] createDepositCheckout error:', err);
    return null;
  }
}
