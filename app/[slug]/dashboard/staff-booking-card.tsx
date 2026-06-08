'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  slug: string;
  booking: {
    id: string;
    slot_date: string;
    slot_start: string;
    slot_end: string;
    duration_minutes: number;
    booking_notes: string | null;
    tags: string[];
    clientName: string;
  };
  showActions: boolean;
  bookingLabel: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatDuration(mins: number): string {
  if (mins >= 60 && mins % 60 === 0) return `${mins / 60}h`;
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}min`;
  return `${mins} min`;
}

function buildGoogleCalUrl(booking: Props['booking'], bookingLabel: string): string {
  const start = `${booking.slot_date.replace(/-/g, '')}T${booking.slot_start.replace(/:/g, '')}00`;
  const end = `${booking.slot_date.replace(/-/g, '')}T${booking.slot_end.replace(/:/g, '')}00`;
  const title = encodeURIComponent(`${bookingLabel} with ${booking.clientName}`);
  const details = encodeURIComponent(
    booking.tags.length > 0 ? `Services: ${booking.tags.join(', ')}` : ''
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}`;
}

export default function StaffBookingCard({ slug, booking, showActions, bookingLabel }: Props) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [showDeclineInput, setShowDeclineInput] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [error, setError] = useState('');
  const [calendarUrl, setCalendarUrl] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  async function handleAccept() {
    setAccepting(true);
    setError('');
    try {
      const res = await fetch(`/api/${slug}/bookings/${booking.id}/accept`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to accept');
        return;
      }
      setAccepted(true);
      setCalendarUrl(data.calendarUrl ?? null);
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setAccepting(false);
    }
  }

  async function handleDecline() {
    setDeclining(true);
    setError('');
    try {
      const res = await fetch(`/api/${slug}/bookings/${booking.id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: declineReason || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to decline');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setDeclining(false);
    }
  }

  if (accepted) {
    return (
      <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-4">
        <p className="text-emerald-400 text-sm font-medium">
          Confirmed
        </p>
        {calendarUrl && (
          <a
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-400 hover:text-white transition-colors mt-1 inline-block"
          >
            Add to Google Calendar &nearr;
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-white text-sm font-medium">
            {formatDate(booking.slot_date)} &mdash; {booking.slot_start.slice(0, 5)}&ndash;{booking.slot_end.slice(0, 5)}
          </p>
          <p className="text-zinc-400 text-xs mt-0.5">
            {formatDuration(booking.duration_minutes)} &middot; {booking.clientName}
          </p>
        </div>
        {!showActions && (
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={buildGoogleCalUrl(booking, bookingLabel)}
              target="_blank"
              rel="noopener noreferrer"
              title="Add to Calendar"
              onClick={e => e.stopPropagation()}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </a>
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
              {bookingLabel}
            </span>
          </div>
        )}
      </div>

      {booking.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {booking.tags.map(tag => (
            <span
              key={tag}
              className="bg-zinc-800 border border-zinc-700 rounded-full px-2 py-0.5 text-[11px] text-zinc-300"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {booking.booking_notes && (
        <p className="text-xs text-zinc-500 line-clamp-2">{booking.booking_notes}</p>
      )}

      {showActions && (
        <div className="space-y-2 pt-1">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAccept}
              disabled={accepting}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {accepting ? 'Accepting...' : 'Accept'}
            </button>
            <button
              type="button"
              onClick={() => setShowDeclineInput(!showDeclineInput)}
              className="px-4 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded-lg transition-colors"
            >
              Decline
            </button>
          </div>

          {showDeclineInput && (
            <div className="flex gap-2">
              <input
                type="text"
                value={declineReason}
                onChange={e => setDeclineReason(e.target.value)}
                placeholder="Reason (optional)"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
              <button
                type="button"
                onClick={handleDecline}
                disabled={declining}
                className="px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-200 text-xs rounded-lg transition-colors disabled:opacity-50"
              >
                {declining ? 'Declining...' : 'Confirm Decline'}
              </button>
            </div>
          )}

          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
      )}
    </div>
  );
}
