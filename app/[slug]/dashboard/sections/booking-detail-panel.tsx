'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTenantConfig } from '@/lib/context/tenant-config';
import Badge from '@/components/ui/badge';

export interface BookingDetailJoin {
  pseudonym?: string;
  display_name?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  wa_opt_in?: boolean | null;
}

export interface BookingDetail {
  id: string;
  slot_date: string;
  slot_start: string;
  slot_end: string;
  duration_minutes: number;
  status: string;
  source?: string | null;
  booking_notes?: string | null;
  service_address?: string | null;
  reference_image_url?: string | null;
  edited_at?: string | null;
  total_price?: number | string | null;
  tag_extras_total?: number | string | null;
  base_rate_per_30?: number | string | null;
  payment_status?: string | null;
  deposit_amount?: number | string | null;
  payment?: { method: string | null; paid_at: string | null; checkout_url: string | null } | null;
  created_at?: string | null;
  confirmed_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  staff: BookingDetailJoin | BookingDetailJoin[] | null;
  clients: BookingDetailJoin | BookingDetailJoin[] | null;
  guest_clients: BookingDetailJoin | BookingDetailJoin[] | null;
  booking_service_tags: Array<{ tag_name: string; extra_price?: number | string | null }>;
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

// Shared payment-status presentation, reused by the booking tables and Kanban.
const PAYMENT_STATUS_META: Record<
  string,
  { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }
> = {
  deposit_pending: { label: 'Deposit pending', variant: 'warning' },
  deposit_paid: { label: 'Deposit paid', variant: 'success' },
  paid: { label: 'Paid', variant: 'success' },
  refunded: { label: 'Refunded', variant: 'info' },
};

export function PaymentStatusBadge({ status }: { status?: string | null }) {
  if (!status || status === 'unpaid') return null;
  const meta = PAYMENT_STATUS_META[status];
  if (!meta) return null;
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

interface TerminalOption {
  id: string;
  device_name: string;
  masked_terminal_id: string | null;
}

/**
 * Payment actions for the detail panel (Phase 18). "Charge to terminal" when a
 * balance is outstanding and the tenant has registered ≥1 active terminal;
 * "Download receipt" once the booking is fully paid. Terminals are loaded
 * lazily so panels for unpaid/non-payment bookings stay cheap.
 */
function PaymentActions({
  slug,
  booking,
  onChanged,
}: {
  slug: string;
  booking: BookingDetail;
  onChanged?: () => void;
}) {
  const [terminals, setTerminals] = useState<TerminalOption[] | null>(null);
  const [selected, setSelected] = useState('');
  const [charging, setCharging] = useState(false);

  const paymentStatus = booking.payment_status ?? 'unpaid';
  const isPaid = paymentStatus === 'paid';
  const total = Number(booking.total_price ?? 0);
  const chargeable =
    !isPaid && total > 0 && !['cancelled'].includes(booking.status);

  useEffect(() => {
    if (!chargeable) return;
    let cancelled = false;
    fetch(`/api/${slug}/integrations/mollie/terminals`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        setTerminals(data.terminals ?? []);
      })
      .catch(() => {
        if (!cancelled) setTerminals([]);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, chargeable]);

  async function charge() {
    setCharging(true);
    try {
      const body =
        terminals && terminals.length > 1 && selected ? { terminal_id: selected } : {};
      const res = await fetch(`/api/${slug}/bookings/${booking.id}/charge-terminal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't start the terminal payment.");
        return;
      }
      toast.success(
        `Charging ${data.terminal ?? 'terminal'} — complete the payment on the reader.`
      );
      onChanged?.();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setCharging(false);
    }
  }

  if (!chargeable && !isPaid) return null;

  const hasTerminals = (terminals?.length ?? 0) > 0;
  const needsSelect = (terminals?.length ?? 0) > 1;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border">
      {chargeable && hasTerminals && (
        <>
          {needsSelect && (
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              className="text-xs bg-elevated border border-border rounded px-2 py-1 text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Choose terminal…</option>
              {terminals!.map(t => (
                <option key={t.id} value={t.id}>
                  {t.device_name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={charge}
            disabled={charging || (needsSelect && !selected)}
            className="text-xs px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
          >
            {charging ? 'Charging…' : 'Charge to terminal'}
          </button>
        </>
      )}
      {isPaid && (
        <a
          href={`/api/${slug}/bookings/${booking.id}/receipt`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-3 py-1 bg-elevated hover:bg-sunken text-fg rounded"
        >
          Download receipt
        </a>
      )}
    </div>
  );
}

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          toast.success('Payment link copied.');
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error('Could not copy. Link: ' + url);
        }
      }}
      className="mt-1.5 text-xs px-2 py-1 bg-elevated hover:bg-sunken text-fg rounded"
    >
      {copied ? 'Copied' : 'Copy payment link'}
    </button>
  );
}

function fmtMoney(amount: number | string | null | undefined, currency: string): string | null {
  const n = Number(amount);
  if (amount == null || !Number.isFinite(n)) return null;
  try {
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency: currency || 'EUR' }).format(n);
  } catch {
    return `${currency || 'EUR'} ${n.toFixed(2)}`;
  }
}

function fmtTimestamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-fg-subtle mb-0.5">{label}</p>
      <div className="text-xs text-fg">{children}</div>
    </div>
  );
}

/**
 * Inline booking detail panel: client contact, notes, services + pricing,
 * source and lifecycle timestamps. Used by the expandable rows on the
 * Bookings tab and by the calendar view.
 */
// Lazy signed-URL loader for the private reference image.
function ReferenceImage({ slug, bookingId }: { slug: string; bookingId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/${slug}/bookings/${bookingId}/reference-image`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data.url) {
          setFailed(true);
          return;
        }
        setUrl(data.url);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, bookingId]);

  if (failed) return <span className="text-fg-muted">Couldn&apos;t load image.</span>;
  if (!url) return <span className="text-fg-muted">Loading…</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title="Open full size">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Client reference"
        className="w-24 h-24 rounded-lg object-cover border border-border hover:opacity-90"
      />
    </a>
  );
}

export default function BookingDetailPanel({
  booking,
  currency = 'EUR',
  slug,
  onEdit,
  onChanged,
}: {
  booking: BookingDetail;
  currency?: string;
  slug?: string;
  /** When provided, shows an Edit button for editable statuses (B7). */
  onEdit?: (bookingId: string) => void;
  /** Called after a payment action (e.g. charge to terminal) so lists reload. */
  onChanged?: () => void;
}) {
  const { terminology, featureFlags } = useTenantConfig();

  const client = pickOne(booking.clients);
  const guest = pickOne(booking.guest_clients);
  const contact = client ?? guest;
  const staff = pickOne(booking.staff);

  const total = fmtMoney(booking.total_price, currency);
  const requested = fmtTimestamp(booking.created_at);
  const confirmed = fmtTimestamp(booking.confirmed_at);
  const cancelled = fmtTimestamp(booking.cancelled_at);
  const notesLabel = featureFlags.booking_notes_label || 'Notes';

  const paymentStatus = booking.payment_status ?? 'unpaid';
  const depositAmount = fmtMoney(booking.deposit_amount, currency);
  const paymentMethod = booking.payment?.method ?? null;
  const paidAt = fmtTimestamp(booking.payment?.paid_at);
  const checkoutUrl = booking.payment?.checkout_url ?? null;
  const showPayment = paymentStatus !== 'unpaid' || !!depositAmount;

  return (
    <div className="bg-elevated/60 border-t border-border px-4 py-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
        <DetailItem label={terminology.client}>
          <p className="font-medium">{client?.display_name ?? guest?.name ?? 'Unknown'}</p>
          {contact?.email && (
            <p className="text-fg-muted">
              <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a>
            </p>
          )}
          {contact?.phone && (
            <p className="text-fg-muted">
              <a href={`tel:${contact.phone}`} className="hover:underline">{contact.phone}</a>
            </p>
          )}
          {contact && (
            <p className="text-fg-muted mt-0.5">
              WhatsApp: {contact.wa_opt_in ? 'opted in' : 'not opted in'}
            </p>
          )}
        </DetailItem>

        <DetailItem label={terminology.staff}>
          {staff?.pseudonym ?? <span className="text-fg-muted">Unassigned — pool</span>}
        </DetailItem>

        <DetailItem label="Services">
          {booking.booking_service_tags.length === 0 ? (
            <span className="text-fg-muted">—</span>
          ) : (
            <ul className="space-y-0.5">
              {booking.booking_service_tags.map(t => {
                const extra = fmtMoney(t.extra_price, currency);
                return (
                  <li key={t.tag_name} className="flex justify-between gap-3">
                    <span>{t.tag_name}</span>
                    {extra && Number(t.extra_price) > 0 && (
                      <span className="text-fg-muted">+{extra}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {total && (
            <p className="mt-1 pt-1 border-t border-border flex justify-between gap-3 font-medium">
              <span>Total</span>
              <span>{total}</span>
            </p>
          )}
        </DetailItem>

        {showPayment && (
          <DetailItem label="Payment">
            <div className="flex items-center gap-2 mb-1">
              <PaymentStatusBadge status={paymentStatus} />
              {paymentStatus === 'unpaid' && <span className="text-fg-muted">Unpaid</span>}
            </div>
            {depositAmount && (
              <p className="text-fg-muted">Deposit: {depositAmount}</p>
            )}
            {paymentMethod && <p className="text-fg-muted">Method: {paymentMethod}</p>}
            {paidAt && <p className="text-fg-muted">Paid {paidAt}</p>}
            {paymentStatus === 'deposit_pending' && checkoutUrl && (
              <CopyLinkButton url={checkoutUrl} />
            )}
          </DetailItem>
        )}

        {booking.booking_notes && (
          <DetailItem label={notesLabel}>
            <p className="whitespace-pre-wrap text-fg-muted">{booking.booking_notes}</p>
          </DetailItem>
        )}

        {booking.service_address && (
          <DetailItem label="Service address">
            <p className="whitespace-pre-wrap">{booking.service_address}</p>
          </DetailItem>
        )}

        {booking.reference_image_url && slug && (
          <DetailItem label="Reference image">
            <ReferenceImage slug={slug} bookingId={booking.id} />
          </DetailItem>
        )}

        <DetailItem label="History">
          <p className="text-fg-muted">
            Source: <Badge variant="outline">{booking.source === 'manual' ? 'Manual' : 'Widget'}</Badge>
            {booking.edited_at && (
              <span className="ml-1.5">
                <Badge variant="warning">Edited</Badge>
              </span>
            )}
          </p>
          {requested && <p className="text-fg-muted mt-0.5">Requested {requested}</p>}
          {confirmed && <p className="text-fg-muted">Confirmed {confirmed}</p>}
          {cancelled && <p className="text-fg-muted">Cancelled {cancelled}</p>}
          {booking.edited_at && (
            <p className="text-fg-muted">Edited {fmtTimestamp(booking.edited_at)}</p>
          )}
          {booking.cancellation_reason && (
            <p className="text-fg-muted">Reason: {booking.cancellation_reason}</p>
          )}
        </DetailItem>
      </div>

      {slug && <PaymentActions slug={slug} booking={booking} onChanged={onChanged} />}

      {onEdit && ['pending_staff', 'confirmed', 'completed'].includes(booking.status) && (
        <div className="flex justify-end mt-3">
          <button
            type="button"
            onClick={() => onEdit(booking.id)}
            className="text-xs px-3 py-1 bg-elevated hover:bg-sunken text-fg rounded"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
