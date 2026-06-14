'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTenantConfig } from '@/lib/context/tenant-config';
import EmptyState from '@/components/ui/empty-state';

type Period = '7d' | '30d' | '90d';

interface Analytics {
  kpis: {
    bookings_count: number;
    revenue: number;
    completion_rate: number;
    no_show_rate: number;
    avg_per_staff: number;
    currency: string;
  };
  charts: {
    bookings_by_day: Array<{ date: string; count: number }>;
    revenue_by_week: Array<{ week: string; revenue: number }>;
    source_split: { widget: number; manual: number };
    status_distribution: Record<string, number>;
  };
}

// Chart palette aligned to the ERP status colors (hex, since recharts needs
// concrete values rather than CSS classes).
const CHART = {
  accent: '#2BB673',
  blue: '#3b82f6',
  amber: '#f59e0b',
  slate: '#94a3b8',
  grid: 'rgba(148,163,184,0.2)',
};
const STATUS_COLORS: Record<string, string> = {
  completed: '#3b82f6', // info
  confirmed: '#2BB673', // success
  pending_staff: '#f59e0b', // warning
  cancelled: '#94a3b8', // muted
  no_show: '#ef4444', // danger
};
const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed',
  confirmed: 'Confirmed',
  pending_staff: 'Pending',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency: currency || 'EUR', maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency || 'EUR'} ${amount.toFixed(0)}`;
  }
}

const cardCls = 'rounded-lg border border-border bg-surface p-4';

export default function AnalyticsSection({ slug }: { slug: string }) {
  const { terminology } = useTenantConfig();
  const [period, setPeriod] = useState<Period>('30d');
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${slug}/analytics?period=${period}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Failed to load analytics');
        return;
      }
      setData(json);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [slug, period]);

  useEffect(() => {
    load();
  }, [load]);

  const currency = data?.kpis.currency ?? 'EUR';

  const statusData = data
    ? Object.entries(data.charts.status_distribution)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: STATUS_LABELS[k] ?? k, value: v, key: k }))
    : [];
  const sourceData = data
    ? [
        { name: 'Widget', value: data.charts.source_split.widget, key: 'widget' },
        { name: 'Manual', value: data.charts.source_split.manual, key: 'manual' },
      ].filter(d => d.value > 0)
    : [];

  const hasData = !!data && data.kpis.bookings_count > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-fg">Analytics</h2>
        <div className="flex items-center rounded border border-border overflow-hidden">
          {(['7d', '30d', '90d'] as Period[]).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              aria-pressed={period === p}
              className={`text-xs px-3 py-1.5 transition-colors ${
                period === p ? 'bg-fg text-canvas' : 'bg-surface text-fg-muted hover:bg-elevated'
              }`}
            >
              {p === '7d' ? '7 days' : p === '30d' ? '30 days' : '90 days'}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading ? (
        <AnalyticsSkeleton />
      ) : !hasData ? (
        <EmptyState
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          }
          title="No data for this period"
          description={`Once ${terminology.booking_plural.toLowerCase()} happen in the selected window, metrics and charts appear here.`}
        />
      ) : (
        data && (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Kpi label={`Total ${terminology.booking_plural.toLowerCase()}`} value={String(data.kpis.bookings_count)} />
              <Kpi label="Revenue" value={money(data.kpis.revenue, currency)} accent />
              <Kpi label="Completion" value={`${Math.round(data.kpis.completion_rate * 100)}%`} />
              <Kpi label="No-show" value={`${Math.round(data.kpis.no_show_rate * 100)}%`} warn={data.kpis.no_show_rate > 0.1} />
              <Kpi label={`Avg / ${terminology.staff.toLowerCase()}`} value={String(data.kpis.avg_per_staff)} />
            </div>

            {/* Charts grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className={cardCls}>
                <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">
                  {terminology.booking_plural} by day
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.charts.bookings_by_day}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--fg-muted)' }} tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--fg-muted)' }} width={24} />
                    <Tooltip contentStyle={tooltipStyle} labelFormatter={d => `Date: ${d}`} />
                    <Bar dataKey="count" fill={CHART.accent} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className={cardCls}>
                <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">
                  Revenue by week
                </h3>
                {data.charts.revenue_by_week.length === 0 ? (
                  <ChartEmpty />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={data.charts.revenue_by_week}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                      <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--fg-muted)' }} tickFormatter={w => w.slice(5)} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--fg-muted)' }} width={40} tickFormatter={v => money(Number(v), currency)} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number | string) => money(Number(v), currency)} />
                      <Line type="monotone" dataKey="revenue" stroke={CHART.accent} strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className={cardCls}>
                <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">Source</h3>
                {sourceData.length === 0 ? (
                  <ChartEmpty />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        <Cell fill={CHART.blue} />
                        <Cell fill={CHART.amber} />
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className={cardCls}>
                <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">Status</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={80} paddingAngle={2}>
                      {statusData.map(d => (
                        <Cell key={d.key} fill={STATUS_COLORS[d.key] ?? CHART.slate} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-2">
                  {statusData.map(d => (
                    <span key={d.key} className="inline-flex items-center gap-1 text-[10px] text-fg-muted">
                      <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: STATUS_COLORS[d.key] ?? CHART.slate }} />
                      {d.name} ({d.value})
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-fg-subtle text-center pt-2">Projections coming soon</p>
          </>
        )
      )}
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--fg)',
};

function Kpi({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className={cardCls}>
      <p className="text-[11px] text-fg-muted uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-semibold mt-1 ${accent ? 'text-emerald-600 dark:text-emerald-400' : warn ? 'text-amber-600 dark:text-amber-400' : 'text-fg'}`}>
        {value}
      </p>
    </div>
  );
}

function ChartEmpty() {
  return <div className="h-[220px] flex items-center justify-center text-xs text-fg-subtle">No data in this period</div>;
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-hidden="true">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4">
            <div className="h-3 w-16 bg-elevated rounded mb-2" />
            <div className="h-6 w-12 bg-elevated rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4">
            <div className="h-3 w-24 bg-elevated rounded mb-3" />
            <div className="h-[220px] bg-elevated/50 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
