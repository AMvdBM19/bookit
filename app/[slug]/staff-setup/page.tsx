import { getAuthenticatedUser } from '@/lib/auth/session';
import { resolveTenant } from '@/lib/auth/tenant';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import StaffWizardShell from './wizard-shell';
import type { StaffWizardState } from './wizard-shell';

export default async function StaffSetupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect(`/${slug}/login`);
  }

  if (user.role !== 'staff') {
    redirect(`/${slug}/dashboard`);
  }

  const tenant = await resolveTenant(slug);
  if (!tenant) {
    redirect(`/${slug}/login`);
  }

  const supabase = await createClient();

  let staffId: string;
  if (user.staffId) {
    staffId = user.staffId;
  } else {
    const { data } = await supabase.from('staff').select('id').eq('id', user.id).single();
    if (!data) redirect(`/${slug}/dashboard`);
    staffId = data!.id;
  }

  const { data: staff } = await supabase
    .from('staff')
    .select('*')
    .eq('id', staffId)
    .single();

  if (!staff) redirect(`/${slug}/dashboard`);
  if (staff.wizard_completed) redirect(`/${slug}/dashboard`);

  const { data: tags } = await supabase
    .from('service_tags')
    .select('id, name')
    .eq('tenant_id', user.tenantId)
    .eq('is_active', true)
    .order('display_order');

  const { data: existingTagLinks } = await supabase
    .from('staff_service_tags')
    .select('tag_id')
    .eq('staff_id', staffId);

  const { data: existingSchedule } = await supabase
    .from('staff_schedule')
    .select('day_of_week, start_time, end_time')
    .eq('staff_id', staffId);

  const socialLinks = (staff.social_links ?? {}) as Record<string, string>;
  const selectedTagIds = (existingTagLinks ?? []).map(l => l.tag_id);

  const defaultSchedule = Array.from({ length: 7 }, (_, i) => ({
    day_of_week: i,
    enabled: false,
    start_time: '09:00',
    end_time: '17:00',
  }));

  if (existingSchedule && existingSchedule.length > 0) {
    for (const entry of existingSchedule) {
      const day = defaultSchedule.find(d => d.day_of_week === entry.day_of_week);
      if (day) {
        day.enabled = true;
        day.start_time = entry.start_time.slice(0, 5);
        day.end_time = entry.end_time.slice(0, 5);
      }
    }
  }

  const initialState: StaffWizardState = {
    pseudonym: staff.pseudonym || '',
    bio: staff.bio || '',
    languages: staff.languages ?? [],
    social_links: {
      instagram: socialLinks.instagram ?? '',
      tiktok: socialLinks.tiktok ?? '',
      facebook: socialLinks.facebook ?? '',
      x: socialLinks.x ?? '',
      website: socialLinks.website ?? '',
    },
    gender: staff.gender || '',
    nationality: staff.nationality || '',
    age: staff.age ?? null,
    selected_tag_ids: selectedTagIds,
    schedule: defaultSchedule,
  };

  return (
    <StaffWizardShell
      slug={slug}
      staffId={staffId}
      initialState={initialState}
      availableTags={tags ?? []}
      initialPhotoUrls={(staff.photo_urls as string[] | null) ?? []}
    />
  );
}
