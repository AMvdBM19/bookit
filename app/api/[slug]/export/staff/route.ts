import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { toCsv, csvResponse } from '@/lib/csv';

export const dynamic = 'force-dynamic';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// GET — staff roster with schedule summary as CSV.
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

  const { data: staff, error } = await supabase
    .from('staff')
    .select(`
      id, pseudonym, real_name, status, wizard_completed, created_at,
      staff_schedule(day_of_week, start_time, end_time),
      staff_service_tags(service_tags(name))
    `)
    .eq('tenant_id', user.tenantId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[export:staff] error:', error);
    return NextResponse.json({ error: 'Failed to export staff' }, { status: 500 });
  }

  const headers = ['name', 'real_name', 'status', 'setup_complete', 'services', 'schedule', 'created_at'];

  const rows = (staff ?? []).map(s => {
    const schedule = ((s.staff_schedule ?? []) as Array<{ day_of_week: number; start_time: string; end_time: string }>)
      .slice()
      .sort((a, b) => a.day_of_week - b.day_of_week)
      .map(d => `${DAY_NAMES[d.day_of_week]} ${d.start_time.slice(0, 5)}-${d.end_time.slice(0, 5)}`)
      .join('; ');
    const tags = ((s.staff_service_tags ?? []) as Array<{ service_tags: { name: string } | Array<{ name: string }> | null }>)
      .map(link => {
        const tag = Array.isArray(link.service_tags) ? link.service_tags[0] : link.service_tags;
        return tag?.name ?? null;
      })
      .filter(Boolean)
      .join('; ');
    return [s.pseudonym, s.real_name, s.status, s.wizard_completed, tags, schedule, s.created_at];
  });

  const today = new Date().toISOString().split('T')[0];
  return csvResponse(toCsv(headers, rows), `staff-${slug}-${today}.csv`);
}
