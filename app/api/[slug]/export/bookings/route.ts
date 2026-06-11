import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { toCsv, csvResponse } from '@/lib/csv';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['pending_staff', 'confirmed', 'cancelled', 'completed', 'no_show', 'all'] as const;

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

// GET — all bookings as CSV. Filters: ?status=, ?from=, ?to= (slot_date range).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

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
      id, slot_date, slot_start, slot_end, duration_minutes, status, source,
      total_price, requested_at, confirmed_at, cancelled_at, cancellation_reason, booking_notes,
      staff:staff_id(pseudonym),
      clients:client_id(display_name, email),
      guest_clients:guest_client_id(name, email),
      booking_service_tags(tag_name)
    `)
    .eq('tenant_id', user.tenantId)
    .order('slot_date', { ascending: false })
    .order('slot_start', { ascending: false });

  if (status !== 'all') query = query.eq('status', status);
  if (from) query = query.gte('slot_date', from);
  if (to) query = query.lte('slot_date', to);

  const { data, error } = await query;

  if (error) {
    console.error('[export:bookings] error:', error);
    return NextResponse.json({ error: 'Failed to export bookings' }, { status: 500 });
  }

  const headers = [
    'booking_id',
    'date',
    'start',
    'end',
    'duration_minutes',
    'status',
    'source',
    'staff',
    'client_name',
    'client_email',
    'services',
    'total_price',
    'requested_at',
    'confirmed_at',
    'cancelled_at',
    'cancellation_reason',
    'notes',
  ];

  const rows = (data ?? []).map(b => {
    const staff = pickOne(b.staff as { pseudonym: string } | Array<{ pseudonym: string }> | null);
    const client = pickOne(b.clients as { display_name: string; email: string } | Array<{ display_name: string; email: string }> | null);
    const guest = pickOne(b.guest_clients as { name: string; email: string } | Array<{ name: string; email: string }> | null);
    const tags = (b.booking_service_tags ?? []).map((t: { tag_name: string }) => t.tag_name).join('; ');
    return [
      b.id,
      b.slot_date,
      typeof b.slot_start === 'string' ? b.slot_start.slice(0, 5) : b.slot_start,
      typeof b.slot_end === 'string' ? b.slot_end.slice(0, 5) : b.slot_end,
      b.duration_minutes,
      b.status,
      b.source ?? '',
      staff?.pseudonym ?? '',
      client?.display_name ?? guest?.name ?? '',
      client?.email ?? guest?.email ?? '',
      tags,
      b.total_price,
      b.requested_at,
      b.confirmed_at,
      b.cancelled_at,
      b.cancellation_reason,
      b.booking_notes,
    ];
  });

  const today = new Date().toISOString().split('T')[0];
  return csvResponse(toCsv(headers, rows), `bookings-${slug}-${today}.csv`);
}
