'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Button from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import ConfirmDialog from '@/components/ui/confirm-dialog';

interface ExceptionRow {
  id: string;
  exception_date: string;
  reason: string | null;
  created_by: 'staff' | 'agent' | null;
  created_at: string;
}

const inputCls =
  'text-sm bg-elevated text-fg border border-border rounded px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-border-strong';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Upcoming days-off list + add form for one staff member. */
export default function StaffExceptions({ slug, staffId }: { slug: string; staffId: string }) {
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExceptionRow | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${slug}/staff/${staffId}/exceptions`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load days off');
        return;
      }
      setExceptions(data.exceptions ?? []);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [slug, staffId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/${slug}/staff/${staffId}/exceptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exception_date: date, reason: reason.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't add day off. Please try again.");
        return;
      }
      toast.success('Day off added.');
      setDate('');
      setReason('');
      await reload();
    } catch {
      toast.error("Couldn't add day off. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function remove(target: ExceptionRow) {
    const res = await fetch(`/api/${slug}/staff/${staffId}/exceptions/${target.id}`, {
      method: 'DELETE',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't remove day off. Please try again.");
      return;
    }
    toast.success('Day off removed.');
    await reload();
  }

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center py-8 text-fg-muted">
          <Spinner size="md" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : exceptions.length === 0 ? (
        <p className="text-sm text-fg-muted">No upcoming days off.</p>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-lg bg-surface">
          {exceptions.map(ex => (
            <li key={ex.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm text-fg">{formatDate(ex.exception_date)}</p>
                {ex.reason && <p className="text-xs text-fg-muted truncate">{ex.reason}</p>}
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(ex)}
                className="text-xs px-2 py-1 text-fg-muted hover:text-red-500 rounded transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="space-y-2">
        <p className="text-xs font-medium text-fg-muted uppercase tracking-wider">Add day off</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="date"
            value={date}
            min={todayStr}
            onChange={e => setDate(e.target.value)}
            required
            className={inputCls}
          />
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className={`${inputCls} flex-1`}
          />
          <Button type="submit" variant="primary" size="md" loading={adding} disabled={!date}>
            Add
          </Button>
        </div>
      </form>

      {deleteTarget && (
        <ConfirmDialog
          title="Remove day off?"
          description={`${formatDate(deleteTarget.exception_date)} will become bookable again.`}
          confirmLabel="Remove"
          onConfirm={async () => {
            await remove(deleteTarget);
            setDeleteTarget(null);
          }}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
