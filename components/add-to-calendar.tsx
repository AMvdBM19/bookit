'use client';

import {
  buildGoogleCalendarUrl,
  buildIcsContent,
  type CalendarEvent,
} from '@/lib/calendar/buildUrl';

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

interface Props {
  event: CalendarEvent;
  /** Stable identifier for the ICS UID — use the booking id. */
  uid: string;
}

/** Paired icon buttons: open in Google Calendar / download .ics (Apple, Outlook). */
export default function AddToCalendar({ event, uid }: Props) {
  function handleDownloadIcs() {
    const blob = new Blob([buildIcsContent(event, uid)], {
      type: 'text/calendar;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `booking-${uid.slice(0, 8)}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <span className="inline-flex items-center">
      <a
        href={buildGoogleCalendarUrl(event)}
        target="_blank"
        rel="noopener noreferrer"
        title="Add to Google Calendar"
        aria-label="Add to Google Calendar"
        onClick={e => e.stopPropagation()}
        className="text-fg-muted hover:text-fg transition-colors inline-flex p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CalendarIcon />
      </a>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          handleDownloadIcs();
        }}
        title="Download .ics (Apple / Outlook)"
        aria-label="Download .ics calendar file"
        className="text-fg-muted hover:text-fg transition-colors inline-flex p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <DownloadIcon />
      </button>
    </span>
  );
}
