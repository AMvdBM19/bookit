import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { checkAvailability } from '@/lib/availability/check';
import { getEligibleStaffIds } from '@/lib/availability/pool';
import type { FeatureFlags } from '@/lib/types/tenant-config';
import { DEFAULT_FEATURE_FLAGS } from '@/lib/types/tenant-config';
import { notifyBookingRescheduled } from '@/lib/notifications/dispatch';

// Phase 20-A2: agent-only booking reschedule. Moves a pending_staff/confirmed
// booking to a new date/time (and optionally a new staff member), re-running
// the SAME availability engine the widget uses — excluding the booking itself
// from the conflict check. Status is preserved; only the slot/staff change.

const RESCHEDULABLE = ['pending_staff', 'confirmed'];

/** Add minutes to an HH:MM[:SS] time, returning HH:MM. */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.slice(0, 5).split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  return `${String(hh).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; bookingId: string }> }
) {
  const { bookingId } = await params;

  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = user.tenantId;

  const body = await request.json().catch(() => null);
  const slotDate: string | undefined = body?.slot_date;
  const slotStart: string | undefined = body?.slot_start;
  const requestedStaffId: string | undefined = body?.staff_id || undefined;

  if (!slotDate || !slotStart) {
    return NextResponse.json(
      { error: 'slot_date and slot_start are required' },
      { status: 400 }
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slotDate) || !/^\d{2}:\d{2}/.test(slotStart)) {
    return NextResponse.json({ error: 'Invalid date or time format' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: booking } = await supabase
    .from('bookings')
    .select(
      'id, tenant_id, staff_id, client_id, guest_client_id, slot_date, slot_start, slot_end, duration_minutes, status, reschedule_count'
    )
    .eq('id', bookingId)
    .single();

  if (!booking || booking.tenant_id !== tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!RESCHEDULABLE.includes(booking.status)) {
    return NextResponse.json(
      { error: `Bookings with status "${booking.status}" cannot be rescheduled` },
      { status: 400 }
    );
  }

  const targetStaffId = requestedStaffId ?? booking.staff_id;
  if (!targetStaffId) {
    return NextResponse.json(
      { error: 'A staff member must be selected to reschedule this booking' },
      { status: 400 }
    );
  }

  const newStart = slotStart.slice(0, 5);
  const newEnd = addMinutes(newStart, booking.duration_minutes);
  const newDate = slotDate;

  // Tenant settings (buffers) + feature flags (booking mode).
  const [{ data: settings }, { data: tenantConfig }] = await Promise.all([
    supabase
      .from('tenant_settings')
      .select('buffer_before_minutes, buffer_after_minutes, agency_display_name')
      .eq('tenant_id', tenantId)
      .single(),
    supabase
      .from('tenant_config')
      .select('feature_flags')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
  ]);
  const featureFlags =
    (tenantConfig?.feature_flags as FeatureFlags | undefined) ?? DEFAULT_FEATURE_FLAGS;

  // Validate the target staff belongs to this tenant and is active.
  const { data: staffRow } = await supabase
    .from('staff')
    .select('id, pseudonym')
    .eq('id', targetStaffId)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .single();
  if (!staffRow) {
    return NextResponse.json({ error: 'Selected staff member is not available' }, { status: 400 });
  }

  // Pool mode: the target staff must be eligible for the booking's services.
  if (featureFlags.booking_mode === 'pool') {
    const { data: tagRows } = await supabase
      .from('booking_service_tags')
      .select('tag_id')
      .eq('booking_id', bookingId);
    const tagIds = (tagRows ?? [])
      .map(r => r.tag_id as string | null)
      .filter((id): id is string => !!id);
    const eligible = await getEligibleStaffIds(
      supabase,
      tenantId,
      tagIds.length > 0 ? tagIds : undefined
    );
    if (!eligible.includes(targetStaffId)) {
      return NextResponse.json(
        { error: 'Selected staff member does not offer the booked services' },
        { status: 409 }
      );
    }
  }

  // Availability: same engine as the widget, excluding this booking.
  const availability = await checkAvailability(
    supabase,
    tenantId,
    targetStaffId,
    newDate,
    newStart,
    newEnd,
    {
      bufferBeforeMinutes: settings?.buffer_before_minutes ?? 0,
      bufferAfterMinutes: settings?.buffer_after_minutes ?? 0,
      excludeBookingId: bookingId,
    }
  );
  if (!availability.available) {
    return NextResponse.json(
      { error: availability.reason ?? 'Selected time is not available' },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const staffChanged = targetStaffId !== booking.staff_id;

  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      slot_date: newDate,
      slot_start: newStart,
      slot_end: newEnd,
      staff_id: targetStaffId,
      rescheduled_at: now,
      // No atomic increment in update(); read-modify-write is safe here —
      // reschedule is an agent-serialized action on a single booking.
      reschedule_count: (booking.reschedule_count ?? 0) + 1,
    })
    .eq('id', bookingId)
    .eq('tenant_id', tenantId);

  if (updateError) {
    console.error('[booking:reschedule] update error:', updateError);
    return NextResponse.json({ error: 'Failed to reschedule booking' }, { status: 500 });
  }

  // Audit row.
  const changes: Record<string, { from: unknown; to: unknown }> = {
    change_type: { from: null, to: 'reschedule' },
    slot_date: { from: booking.slot_date, to: newDate },
    slot_start: { from: booking.slot_start?.slice(0, 5), to: newStart },
  };
  if (staffChanged) {
    changes.staff_id = { from: booking.staff_id, to: targetStaffId };
  }
  await supabase.from('booking_edits').insert({
    booking_id: bookingId,
    tenant_id: tenantId,
    edited_by_role: 'agent',
    edited_by_id: null,
    edited_at: now,
    changes,
  });

  // Recipient + dispatch.
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

  await notifyBookingRescheduled(
    tenantId,
    bookingId,
    clientPhone,
    waOptIn,
    {
      client_name: clientName,
      staff_name: staffRow.pseudonym,
      date: newDate,
      time: newStart,
      agency_name: settings?.agency_display_name ?? '',
    },
    recipientType
  );

  return NextResponse.json({
    ok: true,
    slot_date: newDate,
    slot_start: newStart,
    slot_end: newEnd,
    staff_id: targetStaffId,
  });
}
