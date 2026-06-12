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
  const from = sp.get('from');
  const to = sp.get('to');

  if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const supabase = createServiceClient();

  let query = supabase
    .from('bookings')
    .select(`
      id, slot_date, slot_start, slot_end, duration_minutes, booking_notes, status, source,
      service_address, reference_image_url,
      total_price, tag_extras_total, base_rate_per_30,
      created_at: requested_at, confirmed_at, cancelled_at, cancellation_reason,
      staff:staff_id(id, pseudonym),
      clients:client_id(id, display_name, email, phone, wa_opt_in),
      guest_clients:guest_client_id(id, name, email, phone, wa_opt_in),
      booking_service_tags(tag_name, extra_price)
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

  return NextResponse.json({ bookings: data ?? [], total: data?.length ?? 0 });
}
