import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { DEFAULT_FEATURE_FLAGS } from '@/lib/types/tenant-config';
import { notifyBookingCancelled } from '@/lib/notifications/dispatch';

const TARGET_STATUSES = ['completed', 'no_show', 'cancelled'] as const;
type TargetStatus = (typeof TARGET_STATUSES)[number];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; bookingId: string }> }
) {
  const { bookingId } = await params;

  let user;
  try {
    user = await requireRole(['agent', 'staff']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = user.tenantId;

  const body = await request.json().catch(() => null);
  const status = body?.status as TargetStatus | undefined;

  if (!status || !TARGET_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, tenant_id, staff_id, client_id, guest_client_id, slot_date, slot_start, slot_end, status, assigned_by')
    .eq('id', bookingId)
    .single();

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }
  if (booking.tenant_id !== tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Staff: must own the booking. Agent: tenant_id check above is sufficient.
  if (user.role === 'staff') {
    if (!user.staffId) {
      return NextResponse.json({ error: 'No staff ID in session' }, { status: 403 });
    }
    if (booking.staff_id !== user.staffId) {
      return NextResponse.json({ error: 'Not your booking' }, { status: 403 });
    }
  }

  if (status === 'completed' || status === 'no_show') {
    if (booking.status !== 'confirmed') {
      return NextResponse.json(
        { error: `Cannot mark '${status}' on a booking with status '${booking.status}'` },
        { status: 400 }
      );
    }

    // Booking must be in the past: slot_date + slot_end < NOW().
    const endDateTime = new Date(`${booking.slot_date}T${booking.slot_end}`);
    if (endDateTime >= new Date()) {
      return NextResponse.json({ error: 'Booking has not finished yet' }, { status: 400 });
    }

    // Gate staff by the booking_completion_by feature flag.
    if (user.role === 'staff') {
      const { data: config } = await supabase
        .from('tenant_config')
        .select('feature_flags')
        .eq('tenant_id', tenantId)
        .single();
      const completionBy =
        (config?.feature_flags as { booking_completion_by?: string } | null)?.booking_completion_by ??
        DEFAULT_FEATURE_FLAGS.booking_completion_by;
      if (completionBy !== 'staff_and_admin') {
        return NextResponse.json({ error: 'Only an administrator can complete bookings' }, { status: 403 });
      }
    }

    const update =
      status === 'completed'
        ? { status: 'completed', completed_at: new Date().toISOString() }
        : { status: 'no_show' };

    const { error } = await supabase.from('bookings').update(update).eq('id', bookingId);
    if (error) {
      console.error('[bookings:status] update error:', error);
      return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status });
  }

  // status === 'cancelled'
  // Staff may not cancel a booking an administrator assigned to them — only the
  // admin who made the assignment can (Phase 19 A4).
  if (user.role === 'staff' && booking.assigned_by === 'agent_assign') {
    return NextResponse.json(
      { error: 'This booking was assigned by an administrator and can only be cancelled by them.' },
      { status: 403 }
    );
  }
  if (booking.status !== 'pending_staff' && booking.status !== 'confirmed') {
    return NextResponse.json(
      { error: `Cannot cancel a booking with status '${booking.status}'` },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: user.role === 'agent' ? 'agent' : 'staff',
      cancellation_reason: body?.reason || null,
    })
    .eq('id', bookingId);

  if (error) {
    console.error('[bookings:status] cancel error:', error);
    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 });
  }

  // Notify the client of the cancellation (WhatsApp if opted in, email if the
  // tenant has it active). Separate per-recipient queries — embedded joins
  // silently drop rows (gotcha #2). Mirrors the decline route's resolution.
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

  await notifyBookingCancelled(
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

  return NextResponse.json({ ok: true, status });
}
