import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { sendWhatsApp, sendBookingEmail, createNotification } from '@/lib/notifications/dispatch';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; bookingId: string }> }
) {
  const { bookingId } = await params;

  let user;
  try {
    user = await requireRole(['staff']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = user.tenantId;
  const staffId = user.staffId;
  if (!staffId) {
    return NextResponse.json({ error: 'No staff ID in session' }, { status: 403 });
  }

  const supabase = createServiceClient();

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, tenant_id, staff_id, client_id, guest_client_id, slot_date, slot_start, slot_end, duration_minutes, status, booking_service_tags(tag_id)')
    .eq('id', bookingId)
    .single();

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }
  if (booking.tenant_id !== tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (booking.staff_id !== null) {
    return NextResponse.json({ error: 'This booking has already been claimed' }, { status: 409 });
  }
  if (booking.status !== 'pending_staff') {
    return NextResponse.json(
      { error: `Cannot claim a booking with status '${booking.status}'` },
      { status: 400 }
    );
  }

  // Tag eligibility: when the booking carries service tags, the claiming staff
  // member must offer at least one of them. Untagged bookings are open to all.
  const bookingTagIds = (booking.booking_service_tags ?? [])
    .map(t => t.tag_id as string)
    .filter(Boolean);

  if (bookingTagIds.length > 0) {
    const { data: staffTags } = await supabase
      .from('staff_service_tags')
      .select('tag_id')
      .eq('staff_id', staffId)
      .in('tag_id', bookingTagIds);

    if (!staffTags || staffTags.length === 0) {
      return NextResponse.json(
        { error: 'This booking requires services you do not offer' },
        { status: 403 }
      );
    }
  }

  // First-write-wins: the .is('staff_id', null) guard makes the update atomic —
  // it matches zero rows if another staff member claimed first.
  const { data: claimed } = await supabase
    .from('bookings')
    .update({
      staff_id: staffId,
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .is('staff_id', null)
    .select('id')
    .maybeSingle();

  if (!claimed) {
    return NextResponse.json({ error: 'This booking has already been claimed' }, { status: 409 });
  }

  // Resolve names + notify the client (same flow as a regular accept).
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

  const { data: staffRecord } = await supabase
    .from('staff')
    .select('pseudonym')
    .eq('id', staffId)
    .single();
  const staffName = staffRecord?.pseudonym ?? 'Staff';

  const { data: settings } = await supabase
    .from('tenant_settings')
    .select('agency_display_name')
    .eq('tenant_id', tenantId)
    .single();
  const agencyName = settings?.agency_display_name ?? '';

  const confirmVariables = {
    client_name: clientName,
    staff_name: staffName,
    date: booking.slot_date,
    time: booking.slot_start.slice(0, 5),
    duration: String(booking.duration_minutes),
    agency_name: agencyName,
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
    type: 'booking_claimed',
    message: `${staffName} accepted unassigned booking from ${clientName} on ${booking.slot_date}`,
    priority: 3,
    linkedEntity: 'booking',
    linkedId: bookingId,
  });

  return NextResponse.json({ ok: true, bookingId });
}
