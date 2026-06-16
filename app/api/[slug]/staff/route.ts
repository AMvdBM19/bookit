import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

export async function GET() {
  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const [{ data, error }, { data: settings }] = await Promise.all([
    supabase
      .from('staff')
      .select(`
        id, pseudonym, real_name, photo_urls, status, wizard_completed, first_login, created_at,
        staff_service_tags(service_tags(id, name)),
        staff_schedule(day_of_week)
      `)
      .eq('tenant_id', user.tenantId)
      .order('created_at', { ascending: false }),
    supabase.from('tenant_settings').select('max_staff').eq('tenant_id', user.tenantId).maybeSingle(),
  ]);

  if (error) {
    console.error('[staff:list] error:', error);
    return NextResponse.json({ error: 'Failed to load staff' }, { status: 500 });
  }

  return NextResponse.json({ staff: data ?? [], max_staff: settings?.max_staff ?? 5 });
}
