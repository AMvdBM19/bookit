import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; clientId: string }> }
) {
  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { clientId } = await params;
  const supabase = createServiceClient();

  const { data: client } = await supabase
    .from('clients')
    .select('id, real_name, display_name, email, phone, status, wa_opt_in, created_at, anonymized_at')
    .eq('id', clientId)
    .eq('tenant_id', user.tenantId)
    .maybeSingle();

  const { data: guest } = await supabase
    .from('guest_clients')
    .select('id, name, email, phone, wa_opt_in, booking_count, created_at, anonymized_at')
    .eq('id', clientId)
    .eq('tenant_id', user.tenantId)
    .maybeSingle();

  const record = client ?? guest;
  if (!record) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const fkColumn = client ? 'client_id' : 'guest_client_id';

  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id, slot_date, slot_start, slot_end, duration_minutes,
      status, booking_source, booking_notes, total_price,
      deposit_required, deposit_amount, deposit_paid,
      requested_at, confirmed_at, completed_at, cancelled_at,
      custom_field_values
    `)
    .eq(fkColumn, clientId)
    .eq('tenant_id', user.tenantId)
    .order('slot_date', { ascending: false });

  return NextResponse.json({
    exported_at: new Date().toISOString(),
    client_type: client ? 'account' : 'guest',
    client: record,
    bookings: bookings ?? [],
  });
}
