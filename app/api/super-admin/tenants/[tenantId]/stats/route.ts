import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validateSuperAdminKey } from '@/lib/auth/super-admin';

const STATUSES = ['pending_staff', 'confirmed', 'completed', 'cancelled', 'no_show'] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  if (!validateSuperAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tenantId } = await params;
  const supabase = createServiceClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  // Booking counts by status (last 30d)
  const bookingCountsByStatus: Record<string, number> = {};
  await Promise.all(
    STATUSES.map(async status => {
      const { count } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', status)
        .gte('requested_at', thirtyDaysAgo);
      bookingCountsByStatus[status] = count ?? 0;
    })
  );

  // Staff counts
  const [{ count: staffCount }, { count: activeStaffCount }] = await Promise.all([
    supabase.from('staff').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),
  ]);

  // Client / guest counts
  const [{ count: clientCount }, { count: guestCount }] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('guest_clients').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
  ]);

  // WA integration status
  const { data: waIntegration } = await supabase
    .from('tenant_integrations')
    .select('integration_type, is_active')
    .eq('tenant_id', tenantId)
    .in('integration_type', ['twilio_whatsapp', 'meta_whatsapp'])
    .eq('is_active', true)
    .maybeSingle();

  // Last booking date
  const { data: lastBooking } = await supabase
    .from('bookings')
    .select('requested_at')
    .eq('tenant_id', tenantId)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    stats: {
      bookings_by_status_30d: bookingCountsByStatus,
      staff_count: staffCount ?? 0,
      active_staff_count: activeStaffCount ?? 0,
      client_count: clientCount ?? 0,
      guest_count: guestCount ?? 0,
      whatsapp: waIntegration
        ? { configured: true, provider: waIntegration.integration_type }
        : { configured: false, provider: null },
      last_booking_at: lastBooking?.requested_at ?? null,
    },
  });
}
