'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTenantConfig } from '@/lib/context/tenant-config';
import Badge, { type BadgeVariant } from '@/components/ui/badge';
import Modal from '@/components/ui/modal';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import Spinner from '@/components/ui/spinner';
import EmptyState from '@/components/ui/empty-state';

function ClientsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function SectionLoading() {
  return (
    <div className="flex justify-center py-16 text-fg-muted">
      <Spinner size="lg" />
    </div>
  );
}

interface Guest {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  booking_count: number;
  last_seen_at: string;
  created_at: string;
  is_blocked: boolean;
  anonymized_at: string | null;
}

interface Client {
  id: string;
  display_name: string;
  email: string;
  phone: string | null;
  status: 'unverified' | 'pending' | 'approved' | 'rejected' | 'suspended';
  created_at: string;
  anonymized_at: string | null;
}

const CLIENT_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  approved: 'success',
  pending: 'warning',
  unverified: 'default',
  suspended: 'danger',
  rejected: 'outline',
};

const tableWrap = 'border border-border rounded-lg overflow-hidden bg-surface';
const theadCls = 'bg-elevated border-b border-border';
const thCls = 'text-left text-[11px] font-medium uppercase tracking-wider text-fg-muted';

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB');
}

interface Props {
  slug: string;
  clientMode: 'guest' | 'account';
}

export default function ClientsSection({ slug, clientMode }: Props) {
  if (clientMode === 'guest') {
    return <GuestList slug={slug} />;
  }
  return <ClientList slug={slug} />;
}

/* -------------------- Guest mode -------------------- */

function GuestList({ slug }: { slug: string }) {
  const { terminology } = useTenantConfig();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blockTarget, setBlockTarget] = useState<Guest | null>(null);
  const [anonymizeTarget, setAnonymizeTarget] = useState<Guest | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${slug}/guests`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load guests');
        return;
      }
      setGuests(data.guests ?? []);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (loading) return <SectionLoading />;
  if (error) return <p className="text-sm text-red-500">{error}</p>;

  if (guests.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-fg">{terminology.client_plural}</h2>
        <EmptyState
          icon={<ClientsIcon />}
          title={`No ${terminology.client_plural.toLowerCase()} yet`}
          description={`${terminology.client_plural} appear here automatically after their first booking.`}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">{terminology.client_plural}</h2>
        <a
          href={`/api/${slug}/export/clients`}
          download
          className="text-xs px-3 py-1.5 border border-border text-fg rounded hover:bg-elevated transition-colors"
        >
          Export CSV
        </a>
      </div>

      <div className={tableWrap}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className={theadCls}>
              <tr className={thCls}>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">{terminology.booking_plural}</th>
                <th className="px-3 py-2">Last seen</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {guests.map(g => (
                  <tr key={g.id} className={`hover:bg-elevated ${g.is_blocked ? 'opacity-60' : ''}`}>
                    <td className="px-3 py-3 text-fg">{g.name}</td>
                    <td className="px-3 py-3 text-fg-muted">{g.email}</td>
                    <td className="px-3 py-3 text-fg-muted">{g.phone ?? '—'}</td>
                    <td className="px-3 py-3 text-fg-muted">{g.booking_count}</td>
                    <td className="px-3 py-3 text-[11px] text-fg-muted">
                      {formatDateTime(g.last_seen_at)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {g.anonymized_at ? (
                          <Badge variant="outline">Anonymized</Badge>
                        ) : (
                          <>
                            {g.is_blocked ? (
                              <Badge variant="danger">Blocked</Badge>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setBlockTarget(g)}
                                className="text-xs px-2 py-1 bg-elevated hover:bg-red-100 hover:text-red-800 dark:hover:bg-red-500/20 dark:hover:text-red-400 text-fg rounded transition-colors"
                              >
                                Block
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setAnonymizeTarget(g)}
                              className="text-xs px-2 py-1 bg-elevated hover:bg-red-100 hover:text-red-800 dark:hover:bg-red-500/20 dark:hover:text-red-400 text-fg rounded transition-colors"
                            >
                              Erase
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {blockTarget && (
        <BlockGuestModal
          slug={slug}
          guest={blockTarget}
          onClose={() => setBlockTarget(null)}
          onBlocked={() => {
            setBlockTarget(null);
            reload();
          }}
        />
      )}

      {anonymizeTarget && (
        <ConfirmDialog
          title="Anonymize client data"
          description={`Permanently erase all personal data for ${anonymizeTarget.name} (${anonymizeTarget.email})? This includes name, email, phone, and booking notes. This action cannot be undone.`}
          confirmLabel="Erase data"
          confirmVariant="destructive"
          onConfirm={async () => {
            const res = await fetch(`/api/${slug}/clients/${anonymizeTarget.id}/anonymize`, {
              method: 'POST',
            });
            if (res.ok) {
              toast.success('Client data anonymized.');
              setAnonymizeTarget(null);
              reload();
            } else {
              const data = await res.json().catch(() => ({}));
              toast.error(data.error ?? 'Anonymization failed.');
            }
          }}
          onClose={() => setAnonymizeTarget(null)}
        />
      )}
    </div>
  );
}

function BlockGuestModal({
  slug,
  guest,
  onClose,
  onBlocked,
}: {
  slug: string;
  guest: Guest;
  onClose: () => void;
  onBlocked: () => void;
}) {
  const { terminology } = useTenantConfig();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/${slug}/guests/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: guest.email, reason: reason || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to block');
        toast.error(data.error ?? "Couldn't block. Please try again.");
        return;
      }
      toast.success(`${guest.name} blocked.`);
      onBlocked();
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Block ${terminology.client.toLowerCase()}`} onClose={onClose} maxWidth="max-w-sm">
        <p className="text-sm text-fg-muted mb-3">
          Block <span className="font-medium text-fg">{guest.name}</span> ({guest.email}) from making new
          bookings? Existing bookings are not affected.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs text-fg-muted mb-1" htmlFor="block-reason">
              Reason (optional)
            </label>
            <input
              id="block-reason"
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full text-sm bg-elevated border border-border rounded px-3 py-2 text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-border-strong"
              placeholder="Internal note"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="text-sm px-3 py-1.5 text-fg-muted hover:bg-elevated rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="text-sm px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded disabled:opacity-50"
            >
              {submitting ? 'Blocking…' : 'Block'}
            </button>
          </div>
        </form>
    </Modal>
  );
}

/* -------------------- Account mode -------------------- */

function ClientList({ slug }: { slug: string }) {
  const { terminology } = useTenantConfig();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [anonymizeTarget, setAnonymizeTarget] = useState<Client | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${slug}/clients`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load clients');
        return;
      }
      setClients(data.clients ?? []);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function setStatus(c: Client, next: 'approved' | 'suspended') {
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/${slug}/clients/${c.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Couldn't update status. Please try again.");
        return;
      }
      toast.success(next === 'approved' ? `${terminology.client} approved.` : `${terminology.client} suspended.`);
      setClients(prev => prev.map(r => (r.id === c.id ? { ...r, status: next } : r)));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <SectionLoading />;
  if (error) return <p className="text-sm text-red-500">{error}</p>;

  if (clients.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-fg">{terminology.client_plural}</h2>
        <EmptyState
          icon={<ClientsIcon />}
          title={`No ${terminology.client_plural.toLowerCase()} yet`}
          description={`${terminology.client_plural} appear here once they create an account.`}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">{terminology.client_plural}</h2>
        <a
          href={`/api/${slug}/export/clients`}
          download
          className="text-xs px-3 py-1.5 border border-border text-fg rounded hover:bg-elevated transition-colors"
        >
          Export CSV
        </a>
      </div>

      <div className={tableWrap}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className={theadCls}>
              <tr className={thCls}>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Joined</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clients.map(c => {
                  const busy = busyId === c.id;
                  return (
                    <tr key={c.id} className="hover:bg-elevated">
                      <td className="px-3 py-3 text-fg">{c.display_name}</td>
                      <td className="px-3 py-3 text-fg-muted">{c.email}</td>
                      <td className="px-3 py-3 text-fg-muted">{c.phone ?? '—'}</td>
                      <td className="px-3 py-3">
                        <Badge variant={CLIENT_STATUS_VARIANTS[c.status] ?? 'default'}>
                          {c.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-[11px] text-fg-muted">
                        {formatDate(c.created_at)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {c.anonymized_at ? (
                            <Badge variant="outline">Anonymized</Badge>
                          ) : (
                            <>
                              {c.status !== 'approved' && (
                                <button
                                  type="button"
                                  onClick={() => setStatus(c, 'approved')}
                                  disabled={busy}
                                  className="text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
                                >
                                  Approve
                                </button>
                              )}
                              {c.status !== 'suspended' && (
                                <button
                                  type="button"
                                  onClick={() => setStatus(c, 'suspended')}
                                  disabled={busy}
                                  className="text-xs px-2 py-1 bg-elevated hover:bg-sunken text-fg rounded disabled:opacity-50"
                                >
                                  Suspend
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setAnonymizeTarget(c)}
                                disabled={busy}
                                className="text-xs px-2 py-1 bg-elevated hover:bg-red-100 hover:text-red-800 dark:hover:bg-red-500/20 dark:hover:text-red-400 text-fg rounded transition-colors disabled:opacity-50"
                              >
                                Erase
                              </button>
                            </>
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

      {anonymizeTarget && (
        <ConfirmDialog
          title="Anonymize client data"
          description={`Permanently erase all personal data for ${anonymizeTarget.display_name} (${anonymizeTarget.email})? This includes name, email, phone, and booking notes. This action cannot be undone.`}
          confirmLabel="Erase data"
          confirmVariant="destructive"
          onConfirm={async () => {
            const res = await fetch(`/api/${slug}/clients/${anonymizeTarget.id}/anonymize`, {
              method: 'POST',
            });
            if (res.ok) {
              toast.success('Client data anonymized.');
              setAnonymizeTarget(null);
              reload();
            } else {
              const data = await res.json().catch(() => ({}));
              toast.error(data.error ?? 'Anonymization failed.');
            }
          }}
          onClose={() => setAnonymizeTarget(null)}
        />
      )}
    </div>
  );
}
