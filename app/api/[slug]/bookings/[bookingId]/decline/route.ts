import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { notifyBookingDeclined, createNotification } from '@/lib/notifications/dispatch';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; bookingId: string }> }
) {
  const { bookingId } = await params;

  let user;
  try {
    user = await requireRole(['staff', 'agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = user.tenantId;

  const body = await request.json().catch(() => null);

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

  // Staff: must own the booking (their staffId matches)
  // Agent: tenant_id check above is sufficient ownership validation
  if (user.role === 'staff') {
    const staffId = user.staffId;
    if (!staffId) {
      return NextResponse.json({ error: 'No staff ID in session' }, { status: 403 });
    }
    if (booking.staff_id !== staffId) {
      return NextResponse.json({ error: 'Not your booking' }, { status: 403 });
    }
  }

  if (booking.status !== 'pending_staff') {
    return NextResponse.json({ error: `Cannot decline booking with status '${booking.status}'` }, { status: 400 });
  }

  await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: user.role === 'agent' ? 'agent' : 'staff',
      cancellation_reason: body?.reason || null,
    })
    .eq('id', bookingId);

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

  const { data: staffRecord } = booking.staff_id
    ? await supabase.from('staff').select('pseudonym').eq('id', booking.staff_id).single()
    : { data: null };
  const staffName = staffRecord?.pseudonym ?? 'Staff';

  const { data: settings } = await supabase
    .from('tenant_settings')
    .select('agency_display_name')
    .eq('tenant_id', tenantId)
    .single();
  const agencyName = settings?.agency_display_name ?? '';

  await notifyBookingDeclined(
    tenantId,
    bookingId,
    clientPhone,
    waOptIn,
    {
      client_name: clientName,
      staff_name: staffName,
      date: booking.slot_date,
      time: booking.slot_start.slice(0, 5),
      agency_name: agencyName,
    },
    recipientType
  );

  await createNotification({
    tenantId,
    type: 'booking_declined',
    message: `${staffName} declined booking from ${clientName} on ${booking.slot_date}: ${body?.reason || 'No reason given'}`,
    priority: 2,
    linkedEntity: 'booking',
    linkedId: bookingId,
  });

  return NextResponse.json({ ok: true });
}
