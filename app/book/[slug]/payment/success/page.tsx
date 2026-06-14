import { createServiceClient } from '@/lib/supabase/server';
import RetryButton from './retry-button';

export const dynamic = 'force-dynamic';

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency: currency || 'EUR' }).format(amount);
  } catch {
    return `${currency || 'EUR'} ${amount.toFixed(2)}`;
  }
}

// Mollie redirect target after checkout. Reads the latest deposit payment for
// the booking and shows paid / processing / failed. Wrapped by the widget
// layout, so --w-* theme classes apply.
export default async function PaymentSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ booking_id?: string }>;
}) {
  const { slug } = await params;
  const { booking_id: bookingId } = await searchParams;

  let state: 'paid' | 'pending' | 'failed' | 'none' = 'none';
  let amount = 0;
  let currency = 'EUR';

  if (bookingId) {
    const supabase = createServiceClient();
    const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', slug).maybeSingle();
    if (tenant) {
      const { data: payment } = await supabase
        .from('payments')
        .select('status, amount, currency')
        .eq('tenant_id', tenant.id)
        .eq('booking_id', bookingId)
        .eq('payment_type', 'deposit')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (payment) {
        amount = Number(payment.amount);
        currency = payment.currency ?? 'EUR';
        if (payment.status === 'paid') state = 'paid';
        else if (payment.status === 'failed' || payment.status === 'expired' || payment.status === 'cancelled')
          state = 'failed';
        else state = 'pending';
      }
    }
  }

  const heading =
    state === 'paid'
      ? 'Payment received'
      : state === 'pending'
        ? 'Payment processing'
        : state === 'failed'
          ? 'Payment failed'
          : 'Payment status';

  const icon = state === 'paid' ? '✅' : state === 'pending' ? '⏳' : state === 'failed' ? '❌' : 'ℹ️';

  const message =
    state === 'paid'
      ? `We've received your deposit${amount > 0 ? ` of ${money(amount, currency)}` : ''}. Your booking is all set — see you soon!`
      : state === 'pending'
        ? 'Your payment is being processed. This can take a few moments — you can safely close this page; we\'ll confirm by email.'
        : state === 'failed'
          ? 'Your payment didn\'t go through. You can try again below.'
          : 'We couldn\'t find a payment for this booking.';

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="max-w-md mx-auto">
        <div className="w-card w-pad-lg text-center">
          <div className="text-4xl mb-3" aria-hidden>{icon}</div>
          <h1 className="w-tx text-lg font-semibold mb-2">{heading}</h1>
          <p className="w-tx2 text-sm">{message}</p>
          {state === 'failed' && bookingId && <RetryButton slug={slug} bookingId={bookingId} />}
        </div>
        <p className="text-center text-[10px] w-tx3 mt-6">Powered by Book-IT</p>
      </div>
    </div>
  );
}
