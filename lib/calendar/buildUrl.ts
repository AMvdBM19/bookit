export interface CalendarEvent {
  title: string;
  date: string;         // YYYY-MM-DD
  startTime: string;    // HH:MM or HH:MM:SS
  endTime: string;      // HH:MM or HH:MM:SS
  location?: string;
  description?: string;
}

function eventDates(event: CalendarEvent): { start: Date; end: Date } {
  const [year, month, day] = event.date.split('-').map(Number);
  const [startH, startM] = event.startTime.split(':').map(Number);
  const [endH, endM] = event.endTime.split(':').map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, day, startH, startM)),
    end: new Date(Date.UTC(year, month - 1, day, endH, endM)),
  };
}

/** YYYYMMDDTHHMMSSZ — the format both Google Calendar URLs and ICS expect. */
function fmtUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Build a Google Calendar "Add to Calendar" URL from booking details. */
export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const { start, end } = eventDates(event);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${fmtUtc(start)}/${fmtUtc(end)}`,
    ...(event.location ? { location: event.location } : {}),
    ...(event.description ? { details: event.description } : {}),
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Escape text per RFC 5545 (commas, semicolons, backslashes, newlines). */
function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Build an ICS (iCalendar) file body for non-Google calendars (Apple/Outlook). */
export function buildIcsContent(event: CalendarEvent, uid: string): string {
  const { start, end } = eventDates(event);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Book-IT//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fmtUtc(new Date())}`,
    `DTSTART:${fmtUtc(start)}`,
    `DTEND:${fmtUtc(end)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    ...(event.description ? [`DESCRIPTION:${icsEscape(event.description)}`] : []),
    ...(event.location ? [`LOCATION:${icsEscape(event.location)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}
