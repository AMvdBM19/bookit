interface CalendarEvent {
  title: string;
  date: string;         // YYYY-MM-DD
  startTime: string;    // HH:MM
  endTime: string;      // HH:MM
  location?: string;
  description?: string;
}

/** Build a Google Calendar "Add to Calendar" URL from booking details. */
export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const [year, month, day] = event.date.split('-').map(Number);

  const [startH, startM] = event.startTime.split(':').map(Number);
  const [endH, endM] = event.endTime.split(':').map(Number);

  const startDate = new Date(Date.UTC(year, month - 1, day, startH, startM));
  const endDate = new Date(Date.UTC(year, month - 1, day, endH, endM));

  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${fmt(startDate)}/${fmt(endDate)}`,
    ...(event.location ? { location: event.location } : {}),
    ...(event.description ? { details: event.description } : {}),
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
