import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { sendWhatsApp, sendBookingEmail, createNotification } from '@/lib/notifications/dispatch';
import { createDepositCheckout } from '@/lib/payments/checkout';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; bookingId: string }> }
) {
  const { slug, bookingId } = await params;

  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = user.tenantId;

  const body = await request.json().catch(() => null);
  const staffId = body?.staff_id as string | undefined;
  if (!staffId) {
    return NextResponse.json({ error: 'staff_id is required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, tenant_id, staff_id, client_id, guest_client_id, slot_date, slot_start, slot_end, duration_minutes, status')
    .eq('id', bookingId)
    .single();

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }
  if (booking.tenant_id !== tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (booking.staff_id !== null) {
    return NextResponse.json({ error: 'Booking is already assigned' }, { status: 409 });
  }
  if (booking.status !== 'pending_staff') {
    return NextResponse.json(
      { error: `Cannot assign a booking with status '${booking.status}'` },
      { status: 400 }
    );
  }

  const { data: staff } = await supabase
    .from('staff')
    .select('id, pseudonym')
    .eq('id', staffId)
    .eq('tenant_id', tenantId)
    .single();

  if (!staff) {
    return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
  }

  // Guard with .is('staff_id', null) so a concurrent staff claim wins cleanly.
  const { data: assigned } = await supabase
    .from('bookings')
    .update({
      staff_id: staff.id,
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .is('staff_id', null)
    .select('id')
    .maybeSingle();

  if (!assigned) {
    return NextResponse.json({ error: 'This booking has already been claimed' }, { status: 409 });
  }

  let clientName = 'Client';
  let clientPhone: string | null = null;
  let waOptIn = false;
  let recipientType: 'client' | 'guest_client' = 'client';

  if (booking.client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select('display_name, phone, wa_opt_in')
      .eq('id', booking.client_id)
      .single();
    if (client) {
      clientName = client.display_name;
      clientPhone = client.phone;
      waOptIn = client.wa_opt_in;
    }
  } else if (booking.guest_client_id) {
    const { data: guest } = await supabase
      .from('guest_clients')
      .select('name, phone, wa_opt_in')
      .eq('id', booking.guest_client_id)
      .single();
    if (guest) {
      clientName = guest.name;
      clientPhone = guest.phone;
      waOptIn = guest.wa_opt_in;
      recipientType = 'guest_client';
    }
  }

  const { data: settings } = await supabase
    .from('tenant_settings')
    .select('agency_display_name')
    .eq('tenant_id', tenantId)
    .single();
  const agencyName = settings?.agency_display_name ?? '';

  const deposit = await createDepositCheckout(supabase, tenantId, slug, bookingId);

  const confirmVariables = {
    client_name: clientName,
    staff_name: staff.pseudonym,
    date: booking.slot_date,
    time: booking.slot_start.slice(0, 5),
    duration: String(booking.duration_minutes),
    agency_name: agencyName,
    deposit_amount: deposit?.depositFormatted ?? '',
    payment_link: deposit?.checkoutUrl ?? '',
  };
  if (clientPhone && waOptIn) {
    await sendWhatsApp({
      tenantId,
      recipientPhone: clientPhone,
      eventType: 'booking_confirmed',
      variables: confirmVariables,
      recipientType,
      bookingId,
    });
  }
  await sendBookingEmail({
    tenantId,
    bookingId,
    eventType: 'booking_confirmed',
    variables: confirmVariables,
    attachIcs: true,
  });

  await createNotification({
    tenantId,
    type: 'booking_assigned',
    message: `Unassigned booking from ${clientName} on ${booking.slot_date} was assigned to ${staff.pseudonym}`,
    priority: 3,
    linkedEntity: 'booking',
    linkedId: bookingId,
  });

  return NextResponse.json({ ok: true });
}
