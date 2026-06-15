import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { getPaymentProvider } from '@/lib/payments';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.bookit.monoliet.cloud';

/**
 * Phase 18-A2/A3: charge a booking's outstanding balance to a physical Mollie
 * PIN terminal. The amount is the total minus any already-paid deposit; with
 * no deposit it's the full total. Creates a `payments` row (type 'terminal',
 * status pending) and flips the booking's payment_status; the actual paid/
 * failed result is delivered by the existing Mollie webhook.
 *
 * Body: { terminal_id?: string } — the terminal_devices.id to charge to. If
 * omitted and the tenant has exactly one active terminal, that one is used.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; bookingId: string }> }
) {
  const { slug, bookingId } = await params;

  let user;
  try {
    user = await requireRole(['agent', 'staff']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = user.tenantId;

  const body = await request.json().catch(() => ({}));
  const requestedTerminal = typeof body?.terminal_id === 'string' ? body.terminal_id : null;

  const supabase = createServiceClient();

  // Booking must belong to the tenant.
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, tenant_id, total_price, deposit_amount, deposit_paid, payment_status, status')
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }
  if (booking.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot charge a cancelled booking' }, { status: 400 });
  }
  if (booking.payment_status === 'paid') {
    return NextResponse.json({ error: 'This booking is already fully paid' }, { status: 400 });
  }

  const total = Number(booking.total_price ?? 0);
  if (!(total > 0)) {
    return NextResponse.json({ error: 'This booking has no price to charge' }, { status: 400 });
  }
  const depositPaidAmount = booking.deposit_paid ? Number(booking.deposit_amount ?? 0) : 0;
  const charge = Math.round((total - depositPaidAmount) * 100) / 100;
  if (!(charge > 0)) {
    return NextResponse.json({ error: 'Nothing left to charge — balance already covered' }, { status: 400 });
  }

  // Resolve a terminal: the requested one, or the sole active terminal.
  let terminalQuery = supabase
    .from('terminal_devices')
    .select('id, terminal_id, device_name, is_active')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);
  if (requestedTerminal) terminalQuery = terminalQuery.eq('id', requestedTerminal);
  const { data: terminals, error: termError } = await terminalQuery;

  if (termError) {
    return NextResponse.json(
      { error: 'Terminals are not available yet. Register a terminal under Settings → Payments first.' },
      { status: 400 }
    );
  }
  if (!terminals || terminals.length === 0) {
    return NextResponse.json(
      { error: 'No active terminal found. Register one under Settings → Payments.' },
      { status: 400 }
    );
  }
  if (!requestedTerminal && terminals.length > 1) {
    return NextResponse.json(
      { error: 'Multiple terminals registered — choose which one to charge to.' },
      { status: 400 }
    );
  }
  const terminal = terminals[0];

  const provider = await getPaymentProvider(tenantId);
  if (!provider) {
    return NextResponse.json(
      { error: 'Mollie is not configured. Add a Mollie API key under Settings → Payments.' },
      { status: 400 }
    );
  }

  const { data: tenant } = await supabase.from('tenants').select('name').eq('id', tenantId).single();
  const { data: settings } = await supabase
    .from('tenant_settings')
    .select('currency')
    .eq('tenant_id', tenantId)
    .single();
  const currency = settings?.currency ?? 'EUR';
  const shortId = bookingId.slice(0, 8);
  // 'full' when nothing was prepaid; 'terminal' when settling a remaining balance.
  const paymentType = depositPaidAmount > 0 ? 'terminal' : 'full';

  const created = await provider.createTerminalPayment({
    amount: charge,
    currency,
    description: `${tenant?.name ?? 'Booking'} — ${shortId} (terminal)`,
    terminalId: terminal.terminal_id,
    webhookUrl: `${APP_URL}/book/${slug}/api/payments/webhook`,
    metadata: { booking_id: bookingId, tenant_id: tenantId, payment_type: paymentType },
  });

  if (!created) {
    return NextResponse.json(
      { error: "Couldn't start the terminal payment. Check the terminal is online and try again." },
      { status: 502 }
    );
  }

  const { error: insError } = await supabase.from('payments').insert({
    booking_id: bookingId,
    tenant_id: tenantId,
    amount: charge,
    currency,
    payment_type: paymentType,
    status: created.status,
    provider: 'mollie',
    provider_payment_id: created.id,
    method: 'pointofsale',
  });
  if (insError) {
    console.error('[charge-terminal] payment insert error:', insError.message);
    return NextResponse.json({ error: 'Failed to record the payment' }, { status: 500 });
  }

  // Mark the booking as awaiting settlement on the terminal. The webhook flips
  // it to 'paid' once Mollie confirms.
  await supabase
    .from('bookings')
    .update({ payment_status: 'deposit_pending' })
    .eq('id', bookingId)
    .eq('tenant_id', tenantId);

  return NextResponse.json({
    ok: true,
    amount: charge,
    currency,
    terminal: terminal.device_name,
    status: created.status,
  });
}
