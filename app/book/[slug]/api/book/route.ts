import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkAvailability } from '@/lib/availability/check';
import { calculatePricing } from '@/lib/pricing/calculate';
import type { FeatureFlags } from '@/lib/types/tenant-config';
import { DEFAULT_FEATURE_FLAGS } from '@/lib/types/tenant-config';
import { notifyBookingRequest, sendWhatsApp } from '@/lib/notifications/dispatch';
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

  if (!body.staff_id || !body.slot_date || !body.slot_start || !body.slot_end) {
    return NextResponse.json(
      { error: 'staff_id, slot_date, slot_start, slot_end are required' },
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

  if (settings?.require_age_confirm && !body.age_confirmed) {
    return NextResponse.json({ error: 'Age confirmation required' }, { status: 400 });
  }

  if (featureFlags.require_booking_notes && !body.booking_notes?.trim()) {
    return NextResponse.json(
      { error: `${featureFlags.booking_notes_label} is required` },
      { status: 400 }
    );
  }

  const { data: staff } = await supabase
    .from('staff')
    .select('id, pseudonym')
    .eq('id', body.staff_id)
    .eq('tenant_id', tenant.id)
    .eq('status', 'active')
    .single();

  if (!staff) {
    return NextResponse.json({ error: 'Staff not available' }, { status: 400 });
  }

  const availability = await checkAvailability(
    supabase,
    tenant.id,
    body.staff_id,
    body.slot_date,
    body.slot_start,
    body.slot_end
  );

  if (!availability.available) {
    return NextResponse.json(
      { error: availability.reason ?? 'Slot not available' },
      { status: 409 }
    );
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
  let tagDetails: Array<{ id: string; name: string; extra_price: number | null }> = [];
  if (tagIds.length > 0) {
    const { data: tags } = await supabase
      .from('service_tags')
      .select('id, name, extra_price')
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

  const pricing = calculatePricing({
    baseRatePer30min: settings?.base_rate_per_30min ?? 60,
    staffPayoutPct: settings?.staff_payout_pct ?? 70,
    agencySharePct: settings?.agency_share_pct ?? 30,
    durationMinutes,
    tagExtras,
  });

  const status =
    settings?.booking_confirm_mode === 'auto_confirm' ? 'confirmed' : 'pending_staff';
  const confirmedAt = status === 'confirmed' ? new Date().toISOString() : null;

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      tenant_id: tenant.id,
      staff_id: body.staff_id,
      client_id: clientId,
      guest_client_id: guestClientId,
      booking_source: 'client_request',
      slot_date: body.slot_date,
      slot_start: body.slot_start,
      slot_end: body.slot_end,
      duration_minutes: durationMinutes,
      booking_notes: body.booking_notes ? stripHtml(body.booking_notes) : null,
      base_rate_per_30: pricing.baseRatePer30,
      tag_extras_total: pricing.tagExtrasTotal,
      total_price: pricing.totalPrice,
      staff_payout: pricing.staffPayout,
      agency_share: pricing.agencyShare,
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
    await notifyBookingRequest(
      tenant.id,
      booking.id,
      staff.pseudonym,
      clientDisplayName,
      body.slot_date,
      body.slot_start
    );
  }

  if (status === 'confirmed' && clientPhone && waOptIn) {
    const agencyName = settings?.agency_display_name ?? tenant.name;
    await sendWhatsApp({
      tenantId: tenant.id,
      recipientPhone: clientPhone,
      eventType: 'booking_confirmed',
      variables: {
        client_name: clientDisplayName,
        staff_name: staff.pseudonym,
        date: body.slot_date,
        time: body.slot_start,
        duration: String(durationMinutes),
        agency_name: agencyName,
      },
      recipientType: tenant.client_mode === 'guest' ? 'guest_client' : 'client',
      bookingId: booking.id,
    });
  }

  return NextResponse.json({
    ok: true,
    bookingId: booking.id,
    status,
    message:
      status === 'confirmed'
        ? 'Booking confirmed!'
        : 'Booking request submitted. You will be notified when confirmed.',
  });
}
