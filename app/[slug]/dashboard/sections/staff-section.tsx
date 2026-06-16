'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTenantConfig } from '@/lib/context/tenant-config';
import Badge, { type BadgeVariant } from '@/components/ui/badge';
import Modal from '@/components/ui/modal';
import Spinner from '@/components/ui/spinner';
import EmptyState from '@/components/ui/empty-state';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import StaffExceptions from '@/components/staff-exceptions';

interface StaffRow {
  id: string;
  pseudonym: string;
  real_name: string | null;
  photo_urls: string[] | null;
  status: 'active' | 'inactive' | 'offline';
  wizard_completed: boolean;
  first_login: boolean;
  created_at: string;
  staff_service_tags: Array<{
    service_tags:
      | { id: string; name: string }
      | Array<{ id: string; name: string }>
      | null;
  }>;
  staff_schedule: Array<{ day_of_week: number }>;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function tagNamesOf(s: StaffRow): string[] {
  const out: string[] = [];
  for (const link of s.staff_service_tags ?? []) {
    const tag = Array.isArray(link.service_tags) ? link.service_tags[0] : link.service_tags;
    if (tag?.name) out.push(tag.name);
  }
  return out;
}

function scheduleDaysOf(s: StaffRow): string {
  const days = Array.from(new Set((s.staff_schedule ?? []).map(d => d.day_of_week))).sort();
  if (days.length === 0) return '—';
  return days.map(d => DAY_LABELS[d]).join(' ');
}

function initialOf(name: string): string {
  return (name?.[0] ?? '?').toUpperCase();
}

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  active: 'success',
  inactive: 'outline',
  offline: 'warning',
};

export default function StaffSection({ slug }: { slug: string }) {
  const { terminology } = useTenantConfig();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [maxStaff, setMaxStaff] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<StaffRow | null>(null);
  const [exceptionsTarget, setExceptionsTarget] = useState<StaffRow | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${slug}/staff`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load staff');
        return;
      }
      setStaff(data.staff ?? []);
      setMaxStaff(typeof data.max_staff === 'number' ? data.max_staff : null);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function toggleStatus(s: StaffRow) {
    const next = s.status === 'active' ? 'inactive' : 'active';
    setBusyId(s.id);
    try {
      const res = await fetch(`/api/${slug}/staff/${s.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Couldn't update status. Please try again.");
        return;
      }
      toast.success(next === 'active' ? `${terminology.staff} activated.` : `${terminology.staff} deactivated.`);
      setStaff(prev => prev.map(r => (r.id === s.id ? { ...r, status: next } : r)));
    } finally {
      setBusyId(null);
    }
  }

  const activeCount = staff.filter(s => s.status === 'active').length;
  const atLimit = maxStaff != null && activeCount >= maxStaff;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-fg">{terminology.staff_plural}</h2>
          {maxStaff != null && (
            <span className="text-xs text-fg-muted" title="Active team members vs your plan limit">
              {activeCount} / {maxStaff} {terminology.staff_plural.toLowerCase()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/${slug}/export/staff`}
            download
            className="text-xs px-3 py-1.5 border border-border text-fg rounded hover:bg-elevated transition-colors"
          >
            Export CSV
          </a>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            disabled={atLimit}
            title={atLimit ? `Staff limit reached (${maxStaff}). Contact support to raise it.` : undefined}
            className="text-xs px-3 py-1.5 bg-fg text-canvas rounded hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + Add {terminology.staff}
          </button>
        </div>
      </div>
      {atLimit && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          You&apos;ve reached your limit of {maxStaff} active {terminology.staff_plural.toLowerCase()}.
          Deactivate one or contact support to raise your limit.
        </p>
      )}

      {loading && (
        <div className="flex justify-center py-16 text-fg-muted">
          <Spinner size="lg" />
        </div>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && !error && staff.length === 0 && (
        <EmptyState
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
          title={`No ${terminology.staff_plural.toLowerCase()} yet`}
          description={`Add your first team member so ${terminology.client_plural.toLowerCase()} can book with them.`}
          actionLabel={`Add ${terminology.staff.toLowerCase()}`}
          onAction={() => setShowCreate(true)}
        />
      )}

      {!loading && !error && staff.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden bg-surface">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-elevated border-b border-border">
              <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-fg-muted">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Profile</th>
                <th className="px-3 py-2">Tags</th>
                <th className="px-3 py-2">Schedule</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {staff.map(s => {
                  const tags = tagNamesOf(s);
                  const photo = s.photo_urls?.[0];
                  const isInvited = s.first_login && !s.wizard_completed;
                  return (
                    <tr key={s.id} className="hover:bg-elevated">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photo}
                              alt={s.pseudonym}
                              className="w-7 h-7 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-fg text-canvas flex items-center justify-center text-[11px] font-semibold">
                              {initialOf(s.pseudonym)}
                            </div>
                          )}
                          <div>
                            <p className="text-fg font-medium">{s.pseudonym}</p>
                            {s.real_name && (
                              <p className="text-[11px] text-fg-muted">{s.real_name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={STATUS_VARIANT[s.status] ?? 'outline'}>{s.status}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        {isInvited ? (
                          <Badge variant="warning">Invited</Badge>
                        ) : s.wizard_completed ? (
                          <Badge variant="success">Complete</Badge>
                        ) : (
                          <Badge variant="outline">Setup pending</Badge>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {tags.slice(0, 3).map(t => (
                            <span
                              key={t}
                              className="bg-elevated text-fg text-[10px] px-1.5 py-0.5 rounded border border-border"
                            >
                              {t}
                            </span>
                          ))}
                          {tags.length > 3 && (
                            <span className="text-[10px] text-fg-muted">+{tags.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-fg text-xs">
                        {scheduleDaysOf(s)}
                      </td>
                      <td className="px-3 py-3 text-[11px] text-fg-muted">
                        {new Date(s.created_at).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setExceptionsTarget(s)}
                            title="Days off"
                            aria-label={`Days off for ${s.pseudonym}`}
                            className="p-1.5 text-fg-muted hover:text-fg hover:bg-sunken rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="3" y="4" width="18" height="18" rx="2" />
                              <path d="M16 2v4M8 2v4M3 10h18M10 16l4-4M10 12l4 4" />
                            </svg>
                          </button>
                          {s.status === 'active' ? (
                            <button
                              type="button"
                              onClick={() => setDeactivateTarget(s)}
                              disabled={busyId === s.id}
                              className="text-xs px-2 py-1 bg-elevated hover:bg-sunken text-fg rounded disabled:opacity-50"
                            >
                              Deactivate
                            </button>
                          ) : s.wizard_completed ? (
                            <button
                              type="button"
                              onClick={() => toggleStatus(s)}
                              disabled={busyId === s.id}
                              className="text-xs px-2 py-1 bg-elevated hover:bg-sunken text-fg rounded disabled:opacity-50"
                            >
                              Reactivate
                            </button>
                          ) : (
                            <Badge variant="outline">Awaiting profile setup</Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateStaffModal
          slug={slug}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            reload();
          }}
        />
      )}

      {exceptionsTarget && (
        <Modal
          title={`Days off — ${exceptionsTarget.pseudonym}`}
          onClose={() => setExceptionsTarget(null)}
        >
          <StaffExceptions slug={slug} staffId={exceptionsTarget.id} />
        </Modal>
      )}

      {deactivateTarget && (
        <ConfirmDialog
          title={`Deactivate ${deactivateTarget.pseudonym}?`}
          description={`They will no longer appear in the booking widget or receive new ${terminology.booking_plural.toLowerCase()}. Existing ${terminology.booking_plural.toLowerCase()} are not affected.`}
          confirmLabel="Deactivate"
          onConfirm={async () => {
            await toggleStatus(deactivateTarget);
            setDeactivateTarget(null);
          }}
          onClose={() => setDeactivateTarget(null)}
        />
      )}
    </div>
  );
}

function CreateStaffModal({
  slug,
  onClose,
  onCreated,
}: {
  slug: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { terminology } = useTenantConfig();
  const [email, setEmail] = useState('');
  const [pseudonym, setPseudonym] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/${slug}/staff/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pseudonym, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to create staff');
        toast.error(data.error ?? "Couldn't create staff. Please try again.");
        return;
      }
      toast.success(`${terminology.staff} created.`);
      setSuccess(true);
      window.setTimeout(onCreated, 800);
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Add ${terminology.staff}`} onClose={onClose} maxWidth="max-w-sm">
        {success ? (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400">
            {terminology.staff} created. They can sign in with the password you set, then they&apos;ll be prompted
            to change it on first login.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-xs text-fg-muted mb-1" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full text-sm bg-elevated text-fg border border-border rounded px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-border-strong"
                placeholder="staff@example.com"
              />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1" htmlFor="pseudonym">
                Display name
              </label>
              <input
                id="pseudonym"
                type="text"
                value={pseudonym}
                onChange={e => setPseudonym(e.target.value)}
                className="w-full text-sm bg-elevated text-fg border border-border rounded px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-border-strong"
                placeholder="Pseudonym or display name"
              />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1" htmlFor="password">
                Initial password
              </label>
              <input
                id="password"
                type="text"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full text-sm bg-elevated text-fg border border-border rounded px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-border-strong"
                placeholder="Min. 8 characters"
              />
              <p className="text-[11px] text-fg-muted mt-1">
                Share this password with the staff member. They&apos;ll be forced to change it on first login.
              </p>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="text-sm px-3 py-1.5 text-fg hover:bg-elevated rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="text-sm px-4 py-1.5 bg-fg text-canvas rounded hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        )}
    </Modal>
  );
}
