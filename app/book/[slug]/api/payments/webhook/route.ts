import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getPaymentProvider } from '@/lib/payments';
import { sendBookingEmail } from '@/lib/notifications/dispatch';
import { buildReceiptData, receiptTemplateVariables } from '@/lib/payments/receipt';

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency: currency || 'EUR' }).format(amount);
  } catch {
    return `${currency || 'EUR'} ${amount.toFixed(2)}`;
  }
}

// Mollie payment webhook (public — Mollie posts here, no auth). Mollie sends
// `id` form-encoded; we NEVER trust the body's status — we re-fetch the
// payment from Mollie and verify amount + metadata against our stored row.
// Always 200 on handled-or-unknown so Mollie doesn't retry-storm; 5xx only on
// our own transient failure (so Mollie retries).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    return await handleWebhook(request, params);
  } catch (err) {
    console.error('[payments:webhook] unhandled error:', err);
    return NextResponse.json({ ok: true });
  }
}

async function handleWebhook(
  request: NextRequest,
  params: Promise<{ slug: string }>
) {
  const { slug } = await params;

  // Mollie posts application/x-www-form-urlencoded with id=tr_xxx.
  let molliePaymentId = '';
  try {
    const form = await request.formData();
    molliePaymentId = String(form.get('id') ?? '');
  } catch {
    const body = await request.json().catch(() => null);
    molliePaymentId = body?.id ? String(body.id) : '';
  }
  if (!molliePaymentId) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createServiceClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (!tenant) return NextResponse.json({ ok: true });

  const { data: payment } = await supabase
    .from('payments')
    .select('id, booking_id, tenant_id, amount, currency, status, payment_type')
    .eq('provider_payment_id', molliePaymentId)
    .eq('tenant_id', tenant.id)
    .maybeSingle();

  // Unknown payment → idempotent ack (Mollie retries only on non-2xx).
  if (!payment) return NextResponse.json({ ok: true });

  const provider = await getPaymentProvider(payment.tenant_id);
  if (!provider) {
    // Can't verify without a provider — let Mollie retry.
    return NextResponse.json({ error: 'provider unavailable' }, { status: 503 });
  }

  const fetched = await provider.getPayment(molliePaymentId);
  if (!fetched) {
    return NextResponse.json({ error: 'fetch failed' }, { status: 503 });
  }

  // Security: the verified amount + metadata must match the stored record.
  const amountMatches = fetched.amount == null || Math.abs(fetched.amount - Number(payment.amount)) < 0.01;
  const metaMatches =
    !fetched.metadata?.booking_id || fetched.metadata.booking_id === payment.booking_id;
  if (!amountMatches || !metaMatches) {
    console.error('[payments:webhook] verification mismatch', {
      molliePaymentId,
      storedAmount: payment.amount,
      fetchedAmount: fetched.amount,
      metaBooking: fetched.metadata?.booking_id,
      storedBooking: payment.booking_id,
    });
    // Ack to avoid retry-storms, but do NOT apply the state change.
    return NextResponse.json({ ok: true });
  }

  // Update the payment row.
  await supabase
    .from('payments')
    .update({
      status: fetched.status,
      method: fetched.method,
      paid_at: fetched.status === 'paid' ? fetched.paidAt ?? new Date().toISOString() : null,
    })
    .eq('id', payment.id);

  if (fetched.status === 'paid' && payment.payment_type === 'deposit') {
    await supabase
      .from('bookings')
      .update({ deposit_paid: true, payment_status: 'deposit_paid' })
      .eq('id', payment.booking_id)
      .eq('tenant_id', payment.tenant_id);

    // Resolve client + agency names for the payment_received template
    // (date/time/services are auto-filled by sendBookingEmail).
    const { data: bk } = await supabase
      .from('bookings')
      .select('client_id, guest_client_id')
      .eq('id', payment.booking_id)
      .single();
    let clientName = 'Client';
    if (bk?.client_id) {
      const { data: c } = await supabase.from('clients').select('display_name').eq('id', bk.client_id).single();
      clientName = c?.display_name ?? clientName;
    } else if (bk?.guest_client_id) {
      const { data: g } = await supabase.from('guest_clients').select('name').eq('id', bk.guest_client_id).single();
      clientName = g?.name ?? clientName;
    }
    const { data: ts } = await supabase
      .from('tenant_settings')
      .select('agency_display_name')
      .eq('tenant_id', payment.tenant_id)
      .single();

    // Payment-confirmation email (no WhatsApp — transactional payment WA needs
    // template approval, out of scope). No-op if email not active.
    await sendBookingEmail({
      tenantId: payment.tenant_id,
      bookingId: payment.booking_id,
      eventType: 'payment_received',
      variables: {
        client_name: clientName,
        agency_name: ts?.agency_display_name ?? '',
        deposit_amount: formatMoney(Number(payment.amount), payment.currency ?? 'EUR'),
      },
    });
  } else if (fetched.status === 'paid') {
    // Terminal / full payment settled — the booking is now fully paid (Phase 18-A2/A3).
    await supabase
      .from('bookings')
      .update({ payment_status: 'paid' })
      .eq('id', payment.booking_id)
      .eq('tenant_id', payment.tenant_id);

    // Send the receipt email (Phase 18-B1). No-op if email isn't active.
    const receipt = await buildReceiptData(supabase, payment.tenant_id, payment.booking_id);
    if (receipt) {
      await sendBookingEmail({
        tenantId: payment.tenant_id,
        bookingId: payment.booking_id,
        eventType: 'payment_receipt',
        variables: receiptTemplateVariables(receipt),
      });
    }
  } else if (fetched.status === 'failed' || fetched.status === 'expired' || fetched.status === 'cancelled') {
    // Allow a retry — client will see the failure on the redirect page.
    await supabase
      .from('bookings')
      .update({ payment_status: 'unpaid' })
      .eq('id', payment.booking_id)
      .eq('tenant_id', payment.tenant_id);
  }

  return NextResponse.json({ ok: true });
}
