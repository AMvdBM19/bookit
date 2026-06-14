import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkAvailability } from '@/lib/availability/check';
import { checkPoolAvailability } from '@/lib/availability/pool';
import { calculatePricing } from '@/lib/pricing/calculate';
import type { FeatureFlags } from '@/lib/types/tenant-config';
import { DEFAULT_FEATURE_FLAGS } from '@/lib/types/tenant-config';
import { notifyBookingRequest, sendWhatsApp, sendBookingEmail, createNotification } from '@/lib/notifications/dispatch';
import { createDepositCheckout } from '@/lib/payments/checkout';
import { checkRateLimit } from '@/lib/rate-limit/book';

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim();
}

interface BookingBody {
  staff_id?: string;
  slot_date?: string;
  slot_start?: string;
  slot_end?: string;
  tag_ids?: string[];
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  guest_wa_opt_in?: boolean;
  client_id?: string;
  booking_notes?: string;
  age_confirmed?: boolean;
  service_address?: string;
  reference_image_path?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again shortly.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfter) },
      }
    );
  }

  const body = (await request.json().catch(() => null)) as BookingBody | null;

  if (!body) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!body.slot_date || !body.slot_start || !body.slot_end) {
    return NextResponse.json(
      { error: 'slot_date, slot_start, slot_end are required' },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, vertical, client_mode, is_active')
    .eq('slug', slug)
    .single();

  if (!tenant || !tenant.is_active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: settings } = await supabase
    .from('tenant_settings')
    .select('*')
    .eq('tenant_id', tenant.id)
    .single();

  const { data: tenantConfig } = await supabase
    .from('tenant_config')
    .select('feature_flags')
    .eq('tenant_id', tenant.id)
    .maybeSingle();

  const featureFlags = (tenantConfig?.feature_flags as FeatureFlags | undefined) ?? DEFAULT_FEATURE_FLAGS;

  // Pool mode: clients book without choosing staff; the booking lands
  // unassigned. In staff_select mode a staff_id is mandatory.
  const isPoolBooking = featureFlags.booking_mode === 'pool' && !body.staff_id;
  if (!body.staff_id && featureFlags.booking_mode !== 'pool') {
    return NextResponse.json({ error: 'staff_id is required' }, { status: 400 });
  }

  if (settings?.require_age_confirm && !body.age_confirmed) {
    return NextResponse.json({ error: 'Age confirmation required' }, { status: 400 });
  }

  if (featureFlags.require_booking_notes && !body.booking_notes?.trim()) {
    return NextResponse.json(
      { error: `${featureFlags.booking_notes_label} is required` },
      { status: 400 }
    );
  }

  // Conditional booking fields (Phase 15-B5): accepted only when the
  // corresponding feature flag is on; silently ignored otherwise.
  let serviceAddress: string | null = null;
  if (featureFlags.booking_address_field) {
    const addr =
      typeof body.service_address === 'string'
        ? stripHtml(body.service_address).slice(0, 500)
        : '';
    if (!addr) {
      return NextResponse.json({ error: 'Service address is required' }, { status: 400 });
    }
    serviceAddress = addr;
  }

  let referenceImagePath: string | null = null;
  if (featureFlags.booking_reference_image && body.reference_image_path) {
    const p = String(body.reference_image_path);
    // Must be an object path produced by our reference-upload endpoint for
    // this tenant — blocks cross-tenant references and path tricks.
    if (
      !p.startsWith(`${tenant.id}/`) ||
      p.includes('..') ||
      p.length > 300 ||
      !/\.(jpg|png|webp)$/.test(p)
    ) {
      return NextResponse.json({ error: 'Invalid reference image' }, { status: 400 });
    }
    referenceImagePath = p;
  }

  let staff: { id: string; pseudonym: string } | null = null;

  if (body.staff_id) {
    const { data: staffRow } = await supabase
      .from('staff')
      .select('id, pseudonym')
      .eq('id', body.staff_id)
      .eq('tenant_id', tenant.id)
      .eq('status', 'active')
      .single();

    if (!staffRow) {
      return NextResponse.json({ error: 'Staff not available' }, { status: 400 });
    }
    staff = staffRow;

    const availability = await checkAvailability(
      supabase,
      tenant.id,
      body.staff_id,
      body.slot_date,
      body.slot_start,
      body.slot_end,
      {
        bufferBeforeMinutes: settings?.buffer_before_minutes ?? 0,
        bufferAfterMinutes: settings?.buffer_after_minutes ?? 0,
      }
    );

    if (!availability.available) {
      return NextResponse.json(
        { error: availability.reason ?? 'Slot not available' },
        { status: 409 }
      );
    }
  } else {
    // Pool booking: at least one eligible staff member must be free.
    const poolAvailability = await checkPoolAvailability(
      supabase,
      tenant.id,
      body.slot_date,
      Array.isArray(body.tag_ids) && body.tag_ids.length > 0 ? body.tag_ids : undefined,
      body.slot_start,
      body.slot_end,
      {
        bufferBeforeMinutes: settings?.buffer_before_minutes ?? 0,
        bufferAfterMinutes: settings?.buffer_after_minutes ?? 0,
      }
    );

    if (!poolAvailability.available) {
      return NextResponse.json(
        { error: poolAvailability.reason ?? 'Slot not available' },
        { status: 409 }
      );
    }
  }

  let clientId: string | null = null;
  let guestClientId: string | null = null;
  let clientDisplayName = 'Client';
  let clientPhone: string | null = null;
  let waOptIn = false;

  if (tenant.client_mode === 'guest') {
    if (!body.guest_name || !body.guest_email) {
      return NextResponse.json({ error: 'Name and email required' }, { status: 400 });
    }

    const emailLower = body.guest_email.toLowerCase();
    const safeGuestName = stripHtml(body.guest_name);

    const { data: block } = await supabase
      .from('guest_blocks')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('email', emailLower)
      .limit(1)
      .maybeSingle();

    if (block) {
      return NextResponse.json({ error: 'Unable to book at this time' }, { status: 403 });
    }

    const { data: existingGuest } = await supabase
      .from('guest_clients')
      .select('id, booking_count')
      .eq('tenant_id', tenant.id)
      .eq('email', emailLower)
      .maybeSingle();

    if (existingGuest) {
      await supabase
        .from('guest_clients')
        .update({
          name: safeGuestName,
          phone: body.guest_phone || null,
          wa_opt_in: body.guest_wa_opt_in ?? false,
          last_seen_at: new Date().toISOString(),
          booking_count: (existingGuest.booking_count ?? 0) + 1,
        })
        .eq('id', existingGuest.id);
      guestClientId = existingGuest.id;
    } else {
      const { data: newGuest } = await supabase
        .from('guest_clients')
        .insert({
          tenant_id: tenant.id,
          email: emailLower,
          name: safeGuestName,
          phone: body.guest_phone || null,
          wa_opt_in: body.guest_wa_opt_in ?? false,
          booking_count: 1,
        })
        .select('id')
        .single();
      guestClientId = newGuest?.id ?? null;
    }

    clientDisplayName = safeGuestName;
    clientPhone = body.guest_phone || null;
    waOptIn = body.guest_wa_opt_in ?? false;
  } else {
    if (!body.client_id) {
      return NextResponse.json(
        { error: 'Authentication required for account-mode booking' },
        { status: 401 }
      );
    }

    const { data: client } = await supabase
      .from('clients')
      .select('id, display_name, phone, wa_opt_in, status')
      .eq('id', body.client_id)
      .eq('tenant_id', tenant.id)
      .single();

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    if (client.status !== 'approved') {
      return NextResponse.json({ error: 'Client account not approved' }, { status: 403 });
    }

    clientId = client.id;
    clientDisplayName = client.display_name;
    clientPhone = client.phone;
    waOptIn = client.wa_opt_in;
  }

  const tagIds: string[] = Array.isArray(body.tag_ids) ? body.tag_ids : [];
  let tagDetails: Array<{
    id: string;
    name: string;
    extra_price: number | null;
    duration_minutes: number | null;
  }> = [];
  if (tagIds.length > 0) {
    const { data: tags } = await supabase
      .from('service_tags')
      .select('id, name, extra_price, duration_minutes')
      .in('id', tagIds)
      .eq('tenant_id', tenant.id);
    tagDetails = tags ?? [];
  }
  const tagExtras = tagDetails.map(t => t.extra_price ?? 0);

  const [startH, startM] = body.slot_start.split(':').map(Number);
  const [endH, endM] = body.slot_end.split(':').map(Number);
  const durationMinutes = endH * 60 + endM - (startH * 60 + startM);

  if (durationMinutes <= 0) {
    return NextResponse.json({ error: 'Invalid time range' }, { status: 400 });
  }

  // Per-service duration: the submitted slot length must equal the sum of the
  // selected services' durations (NULL duration = default slot length, same
  // semantics as the availability APIs). Blocks tampered clients from
  // underblocking the calendar / underpricing the booking.
  if (settings?.per_service_duration_enabled && tagIds.length > 0) {
    const defaultMinutes = settings?.default_slot_minutes ?? 30;
    const expectedDuration = tagDetails.reduce(
      (sum, t) => sum + (typeof t.duration_minutes === 'number' ? t.duration_minutes : defaultMinutes),
      0
    );
    if (expectedDuration > 0 && durationMinutes !== expectedDuration) {
      return NextResponse.json(
        { error: 'Slot duration does not match the selected services. Please pick your time again.' },
        { status: 409 }
      );
    }
  }

  const pricing = calculatePricing({
    baseRatePer30min: settings?.base_rate_per_30min ?? 60,
    staffPayoutPct: settings?.staff_payout_pct ?? 70,
    agencySharePct: settings?.agency_share_pct ?? 30,
    durationMinutes,
    tagExtras,
  });

  // Deposit computation (same rule the widget shows on the confirm step):
  // deposits supported by the template, a positive %, and the booking longer
  // than the threshold. Persisted at creation so the confirm paths can raise
  // a Mollie checkout (Phase 17-B). Informational before this — never stored.
  const depositPct = Number(settings?.deposit_pct ?? 0);
  const depositThreshold = Number(settings?.deposit_required_above_minutes ?? 0);
  const depositRequired =
    featureFlags.deposits_supported && depositPct > 0 && durationMinutes > depositThreshold;
  const depositAmount = depositRequired
    ? Math.round(pricing.totalPrice * (depositPct / 100) * 100) / 100
    : 0;

  // Pool bookings always require explicit staff acceptance, regardless of
  // booking_confirm_mode.
  const status = isPoolBooking
    ? 'pending_staff'
    : settings?.booking_confirm_mode === 'auto_confirm'
      ? 'confirmed'
      : 'pending_staff';
  const confirmedAt = status === 'confirmed' ? new Date().toISOString() : null;

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      tenant_id: tenant.id,
      staff_id: staff?.id ?? null,
      client_id: clientId,
      guest_client_id: guestClientId,
      booking_source: 'client_request',
      slot_date: body.slot_date,
      slot_start: body.slot_start,
      slot_end: body.slot_end,
      duration_minutes: durationMinutes,
      booking_notes: body.booking_notes ? stripHtml(body.booking_notes) : null,
      service_address: serviceAddress,
      reference_image_url: referenceImagePath,
      base_rate_per_30: pricing.baseRatePer30,
      tag_extras_total: pricing.tagExtrasTotal,
      total_price: pricing.totalPrice,
      staff_payout: pricing.staffPayout,
      agency_share: pricing.agencyShare,
      deposit_required: depositRequired,
      deposit_amount: depositAmount,
      status,
      confirmed_at: confirmedAt,
    })
    .select('id')
    .single();

  if (bookingError || !booking) {
    console.error('[book] insert error:', bookingError);
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }

  if (tagDetails.length > 0) {
    await supabase.from('booking_service_tags').insert(
      tagDetails.map(t => ({
        tenant_id: tenant.id,
        booking_id: booking.id,
        tag_id: t.id,
        tag_name: t.name,
        extra_price: t.extra_price ?? 0,
      }))
    );
  }

  if (status === 'pending_staff') {
    if (staff) {
      await notifyBookingRequest(
        tenant.id,
        booking.id,
        staff.pseudonym,
        clientDisplayName,
        body.slot_date,
        body.slot_start
      );
    } else {
      // Pool booking: no assigned staff to notify — alert the agent instead.
      await createNotification({
        tenantId: tenant.id,
        type: 'booking_request_unassigned',
        message: `New unassigned booking from ${clientDisplayName} on ${body.slot_date} at ${body.slot_start}`,
        priority: 2,
        linkedEntity: 'booking',
        linkedId: booking.id,
      });
    }
  }

  // Auto-confirmed bookings raise the deposit checkout now (pending_staff ones
  // do so on accept). No-op unless deposit_required + Mollie active.
  let checkoutUrl: string | null = null;
  let depositDue: number | null = null;
  if (status === 'confirmed') {
    const deposit = await createDepositCheckout(supabase, tenant.id, slug, booking.id);
    checkoutUrl = deposit?.checkoutUrl ?? null;
    depositDue = deposit?.depositAmount ?? null;

    const agencyName = settings?.agency_display_name ?? tenant.name;
    const variables = {
      client_name: clientDisplayName,
      staff_name: staff?.pseudonym ?? '',
      date: body.slot_date,
      time: body.slot_start,
      duration: String(durationMinutes),
      agency_name: agencyName,
      deposit_amount: deposit?.depositFormatted ?? '',
      payment_link: deposit?.checkoutUrl ?? '',
    };
    if (staff && clientPhone && waOptIn) {
      await sendWhatsApp({
        tenantId: tenant.id,
        recipientPhone: clientPhone,
        eventType: 'booking_confirmed',
        variables,
        recipientType: tenant.client_mode === 'guest' ? 'guest_client' : 'client',
        bookingId: booking.id,
      });
    }
    await sendBookingEmail({
      tenantId: tenant.id,
      bookingId: booking.id,
      eventType: 'booking_confirmed',
      variables,
      attachIcs: true,
    });
  }

  return NextResponse.json({
    ok: true,
    bookingId: booking.id,
    status,
    checkout_url: checkoutUrl,
    deposit_amount: depositDue,
    message:
      status === 'confirmed'
        ? 'Booking confirmed!'
        : 'Booking request submitted. You will be notified when confirmed.',
  });
}
