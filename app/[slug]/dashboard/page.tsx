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
      .select('id, pseudonym, bio, gender, nationality, age, languages, social_links, wizard_completed, staff_service_tags(service_tags(id, name))')
      .eq('id', user.staffId)
      .single();

    if (staff && !staff.wizard_completed) {
      redirect(`/${slug}/staff-setup`);
    }

    const { data: schedule } = await supabase
      .from('staff_schedule')
      .select('day_of_week, start_time, end_time')
      .eq('staff_id', user.staffId)
      .eq('tenant_id', user.tenantId)
      .order('day_of_week');

    const { data: tenantTags } = await supabase
      .from('service_tags')
      .select('id, name')
      .eq('tenant_id', user.tenantId)
      .eq('is_active', true)
      .order('display_order');

    const { data: pendingBookings } = await supabase
      .from('bookings')
      .select(`
        id, slot_date, slot_start, slot_end, duration_minutes, booking_notes, status, source, requested_at,
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
        id, slot_date, slot_start, slot_end, duration_minutes, booking_notes, status, source, requested_at,
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

    // Unassigned pool bookings — staff can claim those matching their tags.
    const { data: unassignedRows } = await supabase
      .from('bookings')
      .select(`
        id, slot_date, slot_start, slot_end, duration_minutes, booking_notes, status, source, requested_at,
        clients(display_name),
        guest_clients(name),
        booking_service_tags(tag_name, tag_id)
      `)
      .eq('tenant_id', user.tenantId)
      .is('staff_id', null)
      .eq('status', 'pending_staff')
      .order('slot_date', { ascending: true });

    const tagJoins = staff?.staff_service_tags as unknown as Array<{
      service_tags: { id: string; name: string } | Array<{ id: string; name: string }> | null;
    }> ?? [];
    const staffTagIds = tagJoins
      .map(t => {
        const tag = Array.isArray(t.service_tags) ? t.service_tags[0] : t.service_tags;
        return tag?.id ?? null;
      })
      .filter((id): id is string => id !== null);
    const staffTagNames = tagJoins
      .map(t => {
        const tag = Array.isArray(t.service_tags) ? t.service_tags[0] : t.service_tags;
        return tag?.name ?? null;
      })
      .filter((n): n is string => n !== null);

    // Only offer bookings this staff member can serve: untagged bookings are
    // open to everyone; tagged ones need at least one overlapping tag.
    const staffTagIdSet = new Set(staffTagIds);
    const unassignedBookings = (unassignedRows ?? []).filter(b => {
      const tagIds = (b.booking_service_tags ?? [])
        .map(t => t.tag_id as string | null)
        .filter((id): id is string => id !== null);
      return tagIds.length === 0 || tagIds.some(id => staffTagIdSet.has(id));
    });

    const rawSchedule = (schedule ?? []).map(s => ({
      day_of_week: s.day_of_week,
      start_time: s.start_time?.slice(0, 5) ?? '09:00',
      end_time: s.end_time?.slice(0, 5) ?? '17:00',
    }));

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const scheduleDisplay = rawSchedule.map(s => ({
      day: dayNames[s.day_of_week] ?? `Day ${s.day_of_week}`,
      start: s.start_time,
      end: s.end_time,
    }));

    return (
      <StaffDashboard
        slug={slug}
        tenantName={tenant?.name ?? slug}
        staffId={user.staffId}
        pendingBookings={pendingBookings ?? []}
        upcomingBookings={upcomingBookings ?? []}
        unassignedBookings={unassignedBookings}
        staffProfile={{
          pseudonym: staff?.pseudonym ?? 'Staff',
          bio: staff?.bio ?? null,
          gender: staff?.gender ?? null,
          nationality: staff?.nationality ?? null,
          age: staff?.age ?? null,
          languages: staff?.languages ?? [],
          socialLinks: (staff?.social_links ?? {}) as Record<string, string>,
          tags: staffTagNames,
          tagIds: staffTagIds,
          schedule: scheduleDisplay,
          rawSchedule,
        }}
        tenantTags={(tenantTags ?? []).map(t => ({ id: t.id, name: t.name }))}
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
        wizardCompleted={tenant?.wizardCompleted ?? false}
      />
    );
  }

  redirect(`/${slug}/login`);
}
