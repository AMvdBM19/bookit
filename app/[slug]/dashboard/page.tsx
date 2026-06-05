import { getAuthenticatedUser } from '@/lib/auth/session';
import { resolveTenant } from '@/lib/auth/tenant';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import StaffDashboard from './staff-dashboard';
import AgentDashboard from './agent-dashboard';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getAuthenticatedUser();

  if (!user) redirect(`/${slug}/login`);

  const tenant = await resolveTenant(slug);

  if (user.role === 'staff' && user.staffId) {
    const supabase = await createClient();

    const { data: staff } = await supabase
      .from('staff')
      .select('wizard_completed')
      .eq('id', user.staffId)
      .single();

    if (staff && !staff.wizard_completed) {
      redirect(`/${slug}/staff-setup`);
    }

    const { data: pendingBookings } = await supabase
      .from('bookings')
      .select(`
        id, slot_date, slot_start, slot_end, duration_minutes, booking_notes, status,
        clients(display_name),
        guest_clients(name),
        booking_service_tags(tag_name)
      `)
      .eq('staff_id', user.staffId)
      .eq('tenant_id', user.tenantId)
      .eq('status', 'pending_staff')
      .order('slot_date', { ascending: true });

    const today = new Date().toISOString().split('T')[0];
    const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const { data: upcomingBookings } = await supabase
      .from('bookings')
      .select(`
        id, slot_date, slot_start, slot_end, duration_minutes, booking_notes, status,
        clients(display_name),
        guest_clients(name),
        booking_service_tags(tag_name)
      `)
      .eq('staff_id', user.staffId)
      .eq('tenant_id', user.tenantId)
      .eq('status', 'confirmed')
      .gte('slot_date', today)
      .lte('slot_date', weekFromNow)
      .order('slot_date', { ascending: true });

    return (
      <StaffDashboard
        slug={slug}
        tenantName={tenant?.name ?? slug}
        pendingBookings={pendingBookings ?? []}
        upcomingBookings={upcomingBookings ?? []}
      />
    );
  }

  if (user.role === 'agent') {
    return (
      <AgentDashboard
        slug={slug}
        tenantName={tenant?.name ?? slug}
        agentEmail={user.email}
        clientMode={tenant?.clientMode ?? 'guest'}
      />
    );
  }

  redirect(`/${slug}/login`);
}
