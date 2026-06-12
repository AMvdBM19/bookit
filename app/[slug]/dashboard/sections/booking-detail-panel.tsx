'use client';

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
  total_price?: number | string | null;
  tag_extras_total?: number | string | null;
  base_rate_per_30?: number | string | null;
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
export default function BookingDetailPanel({
  booking,
  currency = 'EUR',
}: {
  booking: BookingDetail;
  currency?: string;
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

        {booking.booking_notes && (
          <DetailItem label={notesLabel}>
            <p className="whitespace-pre-wrap text-fg-muted">{booking.booking_notes}</p>
          </DetailItem>
        )}

        <DetailItem label="History">
          <p className="text-fg-muted">
            Source: <Badge variant="outline">{booking.source === 'manual' ? 'Manual' : 'Widget'}</Badge>
          </p>
          {requested && <p className="text-fg-muted mt-0.5">Requested {requested}</p>}
          {confirmed && <p className="text-fg-muted">Confirmed {confirmed}</p>}
          {cancelled && <p className="text-fg-muted">Cancelled {cancelled}</p>}
          {booking.cancellation_reason && (
            <p className="text-fg-muted">Reason: {booking.cancellation_reason}</p>
          )}
        </DetailItem>
      </div>
    </div>
  );
}
