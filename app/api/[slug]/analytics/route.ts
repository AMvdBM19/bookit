import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

// Agent analytics for the dashboard panel. All metrics are derived from
// bookings within the requested period; aggregation happens server-side.
// Period is bounded to 7/30/90 days.

const PERIODS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };

function ymd(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ISO week label like 2026-W23.
function isoWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
    );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const periodKey = request.nextUrl.searchParams.get('period') ?? '30d';
  const days = PERIODS[periodKey] ?? 30;

  const supabase = createServiceClient();

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));
  const sinceStr = ymd(since);
  const todayStr = ymd(new Date());

  const { data: settings } = await supabase
    .from('tenant_settings')
    .select('currency')
    .eq('tenant_id', user.tenantId)
    .maybeSingle();
  const currency = settings?.currency ?? 'EUR';

  // Pull the period's bookings once; aggregate in-process (small per-tenant
  // volumes, and it keeps the status/source/revenue derivations consistent).
  const { data: rows, error } = await supabase
    .from('bookings')
    .select('slot_date, status, source, total_price')
    .eq('tenant_id', user.tenantId)
    .gte('slot_date', sinceStr)
    .lte('slot_date', todayStr);

  if (error) {
    console.error('[analytics] query error:', error);
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }

  const bookings = rows ?? [];

  // Active staff count for avg-per-staff.
  const { count: staffCount } = await supabase
    .from('staff')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', user.tenantId)
    .eq('status', 'active');

  const total = bookings.length;
  const completed = bookings.filter(b => b.status === 'completed').length;
  const noShow = bookings.filter(b => b.status === 'no_show').length;
  const cancelled = bookings.filter(b => b.status === 'cancelled').length;
  const confirmed = bookings.filter(b => b.status === 'confirmed').length;
  const pending = bookings.filter(b => b.status === 'pending_staff').length;

  // Revenue = completed bookings' total_price (money actually earned).
  const revenue = bookings
    .filter(b => b.status === 'completed')
    .reduce((sum, b) => sum + Number(b.total_price ?? 0), 0);

  // Completion / no-show rates over bookings whose outcome is decided.
  const decided = completed + noShow + cancelled;
  const completionRate = decided > 0 ? completed / decided : 0;
  const noShowRate = decided > 0 ? noShow / decided : 0;

  const activeStaff = staffCount ?? 0;
  const avgPerStaff = activeStaff > 0 ? total / activeStaff : 0;

  // bookings_by_day — zero-filled across the period.
  const byDay: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 86400000);
    byDay[ymd(d)] = 0;
  }
  for (const b of bookings) {
    if (b.slot_date in byDay) byDay[b.slot_date] += 1;
  }
  const bookingsByDay = Object.entries(byDay).map(([date, count]) => ({ date, count }));

  // revenue_by_week — completed revenue grouped by ISO week.
  const byWeek: Record<string, number> = {};
  for (const b of bookings) {
    if (b.status !== 'completed') continue;
    const wk = isoWeek(b.slot_date);
    byWeek[wk] = (byWeek[wk] ?? 0) + Number(b.total_price ?? 0);
  }
  const revenueByWeek = Object.entries(byWeek)
    .sort(([a], [z]) => a.localeCompare(z))
    .map(([week, rev]) => ({ week, revenue: Math.round(rev * 100) / 100 }));

  const sourceSplit = {
    widget: bookings.filter(b => b.source !== 'manual').length,
    manual: bookings.filter(b => b.source === 'manual').length,
  };

  return NextResponse.json({
    period: periodKey in PERIODS ? periodKey : '30d',
    kpis: {
      bookings_count: total,
      revenue: Math.round(revenue * 100) / 100,
      completion_rate: Math.round(completionRate * 100) / 100,
      no_show_rate: Math.round(noShowRate * 100) / 100,
      avg_per_staff: Math.round(avgPerStaff * 10) / 10,
      currency,
    },
    charts: {
      bookings_by_day: bookingsByDay,
      revenue_by_week: revenueByWeek,
      source_split: sourceSplit,
      status_distribution: {
        completed,
        confirmed,
        pending_staff: pending,
        cancelled,
        no_show: noShow,
      },
    },
  });
}
