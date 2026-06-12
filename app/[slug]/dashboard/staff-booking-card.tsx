'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import AddToCalendar from '@/components/add-to-calendar';
import type { CalendarEvent } from '@/lib/calendar/buildUrl';

interface Props {
  slug: string;
  booking: {
    id: string;
    slot_date: string;
    slot_start: string;
    slot_end: string;
    duration_minutes: number;
    booking_notes: string | null;
    status?: string;
    source?: string | null;
    requested_at?: string | null;
    tags: string[];
    clientName: string;
  };
  showActions: boolean;
  canComplete?: boolean;
  claimable?: boolean;
  bookingLabel: string;
}

function isPastTime(slotDate: string, slotEnd: string): boolean {
  return new Date(`${slotDate}T${slotEnd}`) < new Date();
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

function calendarEventOf(booking: Props['booking'], bookingLabel: string): CalendarEvent {
  return {
    title: `${bookingLabel} with ${booking.clientName}`,
    date: booking.slot_date,
    startTime: booking.slot_start,
    endTime: booking.slot_end,
    ...(booking.tags.length > 0 ? { description: `Services: ${booking.tags.join(', ')}` } : {}),
  };
}

export default function StaffBookingCard({ slug, booking, showActions, canComplete = false, claimable = false, bookingLabel }: Props) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [showDeclineInput, setShowDeclineInput] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [confirmNoShow, setConfirmNoShow] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const showCompletion =
    !showActions &&
    canComplete &&
    booking.status === 'confirmed' &&
    isPastTime(booking.slot_date, booking.slot_end);

  async function handleStatus(status: 'completed' | 'no_show') {
    setCompleting(true);
    setError('');
    try {
      const res = await fetch(`/api/${slug}/bookings/${booking.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to update');
        toast.error(data.error ?? "Couldn't update. Please try again.");
        return;
      }
      toast.success(status === 'completed' ? 'Marked completed.' : 'Marked as no-show.');
      router.refresh();
    } catch {
      setError('Network error');
      toast.error("Couldn't update. Please try again.");
    } finally {
      setCompleting(false);
    }
  }

  async function handleClaim() {
    setAccepting(true);
    setError('');
    try {
      const res = await fetch(`/api/${slug}/bookings/${booking.id}/claim`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to accept');
        toast.error(data.error ?? "Couldn't accept. Please try again.");
        return;
      }
      toast.success(`${bookingLabel} accepted.`);
      setAccepted(true);
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setAccepting(false);
    }
  }

  async function handleAccept() {
    setAccepting(true);
    setError('');
    try {
      const res = await fetch(`/api/${slug}/bookings/${booking.id}/accept`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to accept');
        toast.error(data.error ?? "Couldn't accept. Please try again.");
        return;
      }
      toast.success(`${bookingLabel} accepted.`);
      setAccepted(true);
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
        toast.error(data.error ?? "Couldn't decline. Please try again.");
        return;
      }
      toast.success(`${bookingLabel} declined.`);
      router.refresh();
    } catch {
      setError('Network error');
      toast.error("Couldn't decline. Please try again.");
    } finally {
      setDeclining(false);
    }
  }

  if (accepted) {
    return (
      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
        <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">
          Confirmed
        </p>
        <div className="mt-1 flex items-center gap-1 text-xs text-fg-muted">
          <span>Add to calendar:</span>
          <AddToCalendar event={calendarEventOf(booking, bookingLabel)} uid={booking.id} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-fg text-sm font-medium">
            {formatDate(booking.slot_date)} &mdash; {booking.slot_start.slice(0, 5)}&ndash;{booking.slot_end.slice(0, 5)}
          </p>
          <p className="text-fg-muted text-xs mt-0.5">
            {formatDuration(booking.duration_minutes)} &middot; {booking.clientName}
          </p>
        </div>
        {!showActions && (
          <div className="flex items-center gap-2 shrink-0">
            <AddToCalendar event={calendarEventOf(booking, bookingLabel)} uid={booking.id} />
            <span className="text-[10px] text-fg-subtle uppercase tracking-wider">
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
              className="bg-elevated border border-border rounded-full px-2 py-0.5 text-[11px] text-fg-muted"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {booking.booking_notes && (
        <p className={`text-xs text-fg-subtle ${showDetails ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
          {booking.booking_notes}
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowDetails(v => !v)}
        aria-expanded={showDetails}
        className="text-[11px] text-fg-muted hover:text-fg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        {showDetails ? 'Hide details' : 'See details'}
      </button>

      {showDetails && (
        <div className="text-[11px] text-fg-muted border-t border-border pt-2 space-y-0.5">
          <p>Source: {booking.source === 'manual' ? 'Manual' : 'Widget'}</p>
          {booking.requested_at && (
            <p>
              Requested{' '}
              {new Date(booking.requested_at).toLocaleString('en-GB', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      )}

      {showCompletion && (
        <div className="space-y-2 pt-1">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleStatus('completed')}
              disabled={completing}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {completing ? 'Saving...' : 'Mark completed'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmNoShow(true)}
              disabled={completing}
              className="px-4 py-1.5 bg-elevated hover:bg-sunken text-fg-muted text-xs rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Mark as no-show
            </button>
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          {confirmNoShow && (
            <ConfirmDialog
              title="Mark as no-show?"
              description={`${booking.clientName} will be recorded as not having shown up.`}
              confirmLabel="Mark as no-show"
              onConfirm={async () => {
                await handleStatus('no_show');
                setConfirmNoShow(false);
              }}
              onClose={() => setConfirmNoShow(false)}
            />
          )}
        </div>
      )}

      {claimable && (
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handleClaim}
            disabled={accepting}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {accepting ? 'Accepting...' : 'Accept'}
          </button>
          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>
      )}

      {showActions && (
        <div className="space-y-2 pt-1">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAccept}
              disabled={accepting}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {accepting ? 'Accepting...' : 'Accept'}
            </button>
            <button
              type="button"
              onClick={() => setShowDeclineInput(!showDeclineInput)}
              className="px-4 py-1.5 bg-elevated hover:bg-sunken text-fg text-xs rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                className="flex-1 bg-elevated border border-border rounded-lg px-3 py-1.5 text-xs text-fg placeholder-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="button"
                onClick={handleDecline}
                disabled={declining}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {declining ? 'Declining...' : 'Confirm Decline'}
              </button>
            </div>
          )}

          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>
      )}
    </div>
  );
}
