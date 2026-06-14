import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createDepositCheckout } from '@/lib/payments/checkout';

// Public payment-status lookup for the redirect/success page, with an optional
// retry. GET ?booking_id=… returns the latest payment state for the booking.
// POST ?booking_id=… regenerates a checkout URL when the deposit is still
// unpaid (used by the "try again" button after a failed/expired payment).

function shape(payment: {
  status: string;
  amount: number | string;
  currency: string;
  checkout_url: string | null;
  method: string | null;
} | null) {
  if (!payment) return { status: 'none' as const };
  return {
    status: payment.status,
    amount: Number(payment.amount),
    currency: payment.currency,
    checkout_url: payment.checkout_url,
    method: payment.method,
  };
}

async function latestDeposit(tenantId: string, bookingId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('payments')
    .select('status, amount, currency, checkout_url, method')
    .eq('tenant_id', tenantId)
    .eq('booking_id', bookingId)
    .eq('payment_type', 'deposit')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function resolveTenant(slug: string) {
  const supabase = createServiceClient();
  const { data } = await supabase.from('tenants').select('id').eq('slug', slug).maybeSingle();
  return data?.id ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const bookingId = request.nextUrl.searchParams.get('booking_id') ?? '';
  if (!bookingId) return NextResponse.json({ error: 'booking_id required' }, { status: 400 });

  const tenantId = await resolveTenant(slug);
  if (!tenantId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(shape(await latestDeposit(tenantId, bookingId)));
}

// Retry: regenerate a checkout URL for an unpaid deposit.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const bookingId = request.nextUrl.searchParams.get('booking_id') ?? '';
  if (!bookingId) return NextResponse.json({ error: 'booking_id required' }, { status: 400 });

  const tenantId = await resolveTenant(slug);
  if (!tenantId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const supabase = createServiceClient();

  const existing = await latestDeposit(tenantId, bookingId);
  if (existing?.status === 'paid') {
    return NextResponse.json({ status: 'paid' });
  }
  // Reset to unpaid so createDepositCheckout will mint a fresh payment.
  await supabase
    .from('bookings')
    .update({ payment_status: 'unpaid' })
    .eq('id', bookingId)
    .eq('tenant_id', tenantId);

  const deposit = await createDepositCheckout(supabase, tenantId, slug, bookingId);
  if (!deposit) {
    return NextResponse.json({ error: 'Could not create a new payment' }, { status: 400 });
  }
  return NextResponse.json({ status: 'pending', checkout_url: deposit.checkoutUrl });
}
