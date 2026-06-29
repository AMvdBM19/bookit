import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

const VALID_STATUSES = ['pending_staff', 'confirmed', 'cancelled', 'completed', 'no_show', 'all'] as const;

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const status = sp.get('status') ?? 'all';
  // Accept both from/to (original) and date_from/date_to (Phase 17 filter).
  const from = sp.get('from') ?? sp.get('date_from');
  const to = sp.get('to') ?? sp.get('date_to');

  if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const supabase = createServiceClient();

  let query = supabase
    .from('bookings')
    .select(`
      id, slot_date, slot_start, slot_end, duration_minutes, booking_notes, status, source, assigned_by,
      service_address, reference_image_url, custom_field_values, edited_at, reschedule_count,
      total_price, tag_extras_total, base_rate_per_30, payment_status, deposit_amount,
      created_at: requested_at, confirmed_at, cancelled_at, cancellation_reason,
      staff:staff_id(id, pseudonym),
      clients:client_id(id, display_name, email, phone, wa_opt_in),
      guest_clients:guest_client_id(id, name, email, phone, wa_opt_in),
      booking_service_tags(tag_name, extra_price, quantity)
    `)
    .eq('tenant_id', user.tenantId)
    .order('slot_date', { ascending: false })
    .order('slot_start', { ascending: false });

  if (status !== 'all') {
    query = query.eq('status', status);
  }
  if (from) {
    query = query.gte('slot_date', from);
  }
  if (to) {
    query = query.lte('slot_date', to);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[bookings:list] error:', error);
    return NextResponse.json({ error: 'Failed to load bookings' }, { status: 500 });
  }

  const bookings = data ?? [];

  // Attach the latest deposit payment per booking (separate query + merge —
  // embedded joins drop rows). Only for bookings with a payment state set.
  const payableIds = bookings
    .filter(b => b.payment_status && b.payment_status !== 'unpaid')
    .map(b => b.id);

  const paymentByBooking: Record<string, { method: string | null; paid_at: string | null; checkout_url: string | null }> = {};
  if (payableIds.length > 0) {
    const { data: payments } = await supabase
      .from('payments')
      .select('booking_id, method, paid_at, checkout_url, created_at')
      .eq('tenant_id', user.tenantId)
      .eq('payment_type', 'deposit')
      .in('booking_id', payableIds)
      .order('created_at', { ascending: false });
    for (const p of payments ?? []) {
      // First seen wins = most recent (ordered desc).
      if (!paymentByBooking[p.booking_id]) {
        paymentByBooking[p.booking_id] = {
          method: p.method ?? null,
          paid_at: p.paid_at ?? null,
          checkout_url: p.checkout_url ?? null,
        };
      }
    }
  }

  const merged = bookings.map(b => ({ ...b, payment: paymentByBooking[b.id] ?? null }));

  return NextResponse.json({ bookings: merged, total: merged.length });
}
