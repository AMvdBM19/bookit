import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { toCsv, csvResponse } from '@/lib/csv';

export const dynamic = 'force-dynamic';

// GET — clients (account mode) or guest_clients (guest mode) as CSV.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('client_mode')
    .eq('id', user.tenantId)
    .single();

  const clientMode = tenant?.client_mode ?? 'guest';
  const today = new Date().toISOString().split('T')[0];

  if (clientMode === 'guest') {
    const { data: guests, error } = await supabase
      .from('guest_clients')
      .select('name, email, phone, wa_opt_in, booking_count, last_seen_at, created_at')
      .eq('tenant_id', user.tenantId)
      .order('last_seen_at', { ascending: false });

    if (error) {
      console.error('[export:clients] guest error:', error);
      return NextResponse.json({ error: 'Failed to export clients' }, { status: 500 });
    }

    const headers = ['name', 'email', 'phone', 'whatsapp_opt_in', 'booking_count', 'last_seen_at', 'created_at'];
    const rows = (guests ?? []).map(g => [
      g.name,
      g.email,
      g.phone,
      g.wa_opt_in,
      g.booking_count,
      g.last_seen_at,
      g.created_at,
    ]);
    return csvResponse(toCsv(headers, rows), `clients-${slug}-${today}.csv`);
  }

  const { data: clients, error } = await supabase
    .from('clients')
    .select('display_name, email, phone, status, wa_opt_in, created_at')
    .eq('tenant_id', user.tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[export:clients] error:', error);
    return NextResponse.json({ error: 'Failed to export clients' }, { status: 500 });
  }

  const headers = ['name', 'email', 'phone', 'status', 'whatsapp_opt_in', 'created_at'];
  const rows = (clients ?? []).map(c => [
    c.display_name,
    c.email,
    c.phone,
    c.status,
    c.wa_opt_in,
    c.created_at,
  ]);
  return csvResponse(toCsv(headers, rows), `clients-${slug}-${today}.csv`);
}
