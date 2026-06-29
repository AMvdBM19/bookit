import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { calculatePricing } from '@/lib/pricing/calculate';
import { sendWhatsApp, sendBookingEmail } from '@/lib/notifications/dispatch';

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface ManualBookingBody {
  client_id?: string;
  guest_client_id?: string;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  staff_id?: string | null;
  slot_date?: string;
  slot_start?: string;
  slot_end?: string;
  tag_ids?: string[];
  booking_notes?: string;
  service_address?: string;
  /** Tenant-defined custom field values keyed by field_key (Phase 20-C). */
  custom_field_values?: Record<string, unknown>;
  total_price?: number;
  status: 'pending_staff' | 'confirmed' | 'completed';
  notify_client?: boolean;
}

const VALID_STATUSES = ['pending_staff', 'confirmed', 'completed'] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  await params; // tenant comes from the authenticated session, not the slug

  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = user.tenantId;

  const body = (await request.json().catch(() => null)) as ManualBookingBody | null;
  if (!body) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // a) Client resolution — at most one pattern, else no client (manual is allowed).
  let clientId: string | null = null;
  let guestClientId: string | null = null;
  let recipientType: 'client' | 'guest_client' | null = null;
  let clientName = 'Client';
  let clientPhone: string | null = null;
  let waOptIn = false;

  if (body.client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select('id, display_name, phone, wa_opt_in')
      .eq('id', body.client_id)
      .eq('tenant_id', tenantId)
      .single();
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    clientId = client.id;
    clientName = client.display_name;
    clientPhone = client.phone;
    waOptIn = client.wa_opt_in;
    recipientType = 'client';
  } else if (body.guest_client_id) {
    const { data: guest } = await supabase
      .from('guest_clients')
      .select('id, name, phone, wa_opt_in')
      .eq('id', body.guest_client_id)
      .eq('tenant_id', tenantId)
      .single();
    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }
    guestClientId = guest.id;
    clientName = guest.name;
    clientPhone = guest.phone;
    waOptIn = guest.wa_opt_in;
    recipientType = 'guest_client';
  } else if (body.guest_name && body.guest_email) {
    const emailLower = body.guest_email.toLowerCase().trim();
    const safeName = stripHtml(body.guest_name);
    const { data: existing } = await supabase
      .from('guest_clients')
      .select('id, booking_count')
      .eq('tenant_id', tenantId)
      .eq('email', emailLower)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('guest_clients')
        .update({
          name: safeName,
          phone: body.guest_phone || null,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      guestClientId = existing.id;
    } else {
      const { data: created } = await supabase
        .from('guest_clients')
        .insert({
          tenant_id: tenantId,
          email: emailLower,
          name: safeName,
          phone: body.guest_phone || null,
          booking_count: 0,
        })
        .select('id')
        .single();
      guestClientId = created?.id ?? null;
    }
    clientName = safeName;
    clientPhone = body.guest_phone || null;
    recipientType = 'guest_client';
  }

  // b) Staff validation.
  let staffId: string | null = null;
  let staffName = 'Staff';
  if (body.staff_id) {
    const { data: staff } = await supabase
      .from('staff')
      .select('id, pseudonym')
      .eq('id', body.staff_id)
      .eq('tenant_id', tenantId)
      .single();
    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
    }
    staffId = staff.id;
    staffName = staff.pseudonym;
  }

  // c) Time handling — all-or-nothing.
  const timeFields = [body.slot_date, body.slot_start, body.slot_end];
  const providedCount = timeFields.filter(Boolean).length;
  let slotDate: string;
  let slotStart: string;
  let slotEnd: string;
  let durationMinutes: number;

  if (providedCount === 0) {
    slotDate = new Date().toISOString().split('T')[0];
    slotStart = '00:00';
    slotEnd = '00:00';
    durationMinutes = 0;
  } else if (providedCount === 3) {
    slotDate = body.slot_date as string;
    slotStart = body.slot_start as string;
    slotEnd = body.slot_end as string;
    const [sh, sm] = slotStart.split(':').map(Number);
    const [eh, em] = slotEnd.split(':').map(Number);
    durationMinutes = eh * 60 + em - (sh * 60 + sm);
    if (durationMinutes < 0) {
      return NextResponse.json({ error: 'Invalid time range' }, { status: 400 });
    }
  } else {
    return NextResponse.json(
      { error: 'Provide all of slot_date, slot_start and slot_end, or none' },
      { status: 400 }
    );
  }

  // d) Pricing — fetch tags + settings, then resolve.
  const tagIds: string[] = Array.isArray(body.tag_ids) ? body.tag_ids : [];
  let tagDetails: Array<{ id: string; name: string; extra_price: number | null }> = [];
  if (tagIds.length > 0) {
    const { data: tags } = await supabase
      .from('service_tags')
      .select('id, name, extra_price')
      .in('id', tagIds)
      .eq('tenant_id', tenantId);
    tagDetails = tags ?? [];
  }
  const tagExtras = tagDetails.map(t => t.extra_price ?? 0);
  const tagExtrasTotal = round2(tagExtras.reduce((sum, e) => sum + e, 0));

  const { data: settings } = await supabase
    .from('tenant_settings')
    .select('base_rate_per_30min, staff_payout_pct, agency_share_pct, agency_display_name')
    .eq('tenant_id', tenantId)
    .single();

  const staffPayoutPct = settings?.staff_payout_pct ?? 70;
  const baseRatePer30 = settings?.base_rate_per_30min ?? 0;

  let totalPrice: number;
  let staffPayout: number;
  let agencyShare: number;

  if (body.total_price != null) {
    totalPrice = round2(body.total_price);
    staffPayout = round2(totalPrice * (staffPayoutPct / 100));
    agencyShare = round2(totalPrice - staffPayout);
  } else if (durationMinutes > 0) {
    const pricing = calculatePricing({
      baseRatePer30min: settings?.base_rate_per_30min ?? 60,
      staffPayoutPct,
      agencySharePct: settings?.agency_share_pct ?? 30,
      durationMinutes,
      tagExtras,
    });
    totalPrice = pricing.totalPrice;
    staffPayout = pricing.staffPayout;
    agencyShare = pricing.agencyShare;
  } else {
    totalPrice = 0;
    staffPayout = 0;
    agencyShare = 0;
  }

  // d2) Custom booking fields (Phase 20-C). Lenient on manual bookings — no
  // required enforcement (agents can backfill) — but values are kept only for
  // the tenant's known active field keys, and legacy keys map to columns.
  const { data: fieldDefs } = await supabase
    .from('booking_fields')
    .select('field_key, field_type')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);
  const knownKeys = new Set((fieldDefs ?? []).map(f => f.field_key as string));
  const rawCustom =
    body.custom_field_values && typeof body.custom_field_values === 'object'
      ? (body.custom_field_values as Record<string, unknown>)
      : {};
  const customFieldValues: Record<string, string | string[]> = {};
  for (const [key, val] of Object.entries(rawCustom)) {
    if (!knownKeys.has(key)) continue;
    if (Array.isArray(val)) {
      const arr = val.map(v => stripHtml(String(v))).filter(Boolean);
      if (arr.length > 0) customFieldValues[key] = arr;
    } else if (val != null) {
      const s = stripHtml(String(val)).slice(0, 2000);
      if (s) customFieldValues[key] = s;
    }
  }
  // service_address comes from the custom field or the legacy body field.
  const customAddress =
    typeof customFieldValues.service_address === 'string'
      ? customFieldValues.service_address.slice(0, 500)
      : null;
  const serviceAddress =
    customAddress ??
    (body.service_address ? stripHtml(body.service_address).slice(0, 500) || null : null);
  const referenceImagePath =
    typeof customFieldValues.reference_image === 'string' ? customFieldValues.reference_image : null;

  // e) Insert the booking.
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      tenant_id: tenantId,
      staff_id: staffId,
      client_id: clientId,
      guest_client_id: guestClientId,
      booking_source: 'manual',
      source: 'manual',
      slot_date: slotDate,
      slot_start: slotStart,
      slot_end: slotEnd,
      duration_minutes: durationMinutes,
      booking_notes: body.booking_notes ? stripHtml(body.booking_notes) : null,
      service_address: serviceAddress,
      reference_image_url: referenceImagePath,
      custom_field_values: customFieldValues,
      base_rate_per_30: baseRatePer30,
      tag_extras_total: tagExtrasTotal,
      total_price: totalPrice,
      staff_payout: staffPayout,
      agency_share: agencyShare,
      status: body.status,
      confirmed_at: body.status === 'confirmed' ? new Date().toISOString() : null,
      completed_at: body.status === 'completed' ? new Date().toISOString() : null,
      // A manually-created booking with a staff member is an admin assignment;
      // staff can't self-cancel it (Phase 19 A4).
      assigned_by: staffId ? 'agent_assign' : null,
    })
    .select('id')
    .single();

  if (bookingError || !booking) {
    console.error('[bookings:create] insert error:', bookingError);
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }

  // f) Service tags.
  if (tagDetails.length > 0) {
    await supabase.from('booking_service_tags').insert(
      tagDetails.map(t => ({
        tenant_id: tenantId,
        booking_id: booking.id,
        tag_id: t.id,
        tag_name: t.name,
        extra_price: t.extra_price ?? 0,
      }))
    );
  }

  // g) Notifications — confirmed bookings only, when the agent asked for it.
  if (body.notify_client && body.status === 'confirmed') {
    const agencyName = settings?.agency_display_name ?? '';
    const variables = {
      client_name: clientName,
      staff_name: staffName,
      date: slotDate,
      time: slotStart,
      duration: String(durationMinutes),
      agency_name: agencyName,
    };
    if (clientPhone && waOptIn && recipientType) {
      await sendWhatsApp({
        tenantId,
        recipientPhone: clientPhone,
        eventType: 'booking_confirmed',
        variables,
        recipientType,
        bookingId: booking.id,
      });
    }
    await sendBookingEmail({
      tenantId,
      bookingId: booking.id,
      eventType: 'booking_confirmed',
      variables,
      attachIcs: true,
    });
  }

  return NextResponse.json({ ok: true, bookingId: booking.id });
}
