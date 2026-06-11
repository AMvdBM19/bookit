# Notifications Guide

> WhatsApp messaging, the Templates tab, reminder timing, and the in-app
> notification feed.

## The pipeline in one paragraph

When a notifiable event happens (booking confirmed, declined, cancelled,
reminder due, client approved), the platform looks up the tenant's
**template** for that event + channel, fills in `[variable]` placeholders,
and sends it via the tenant's configured **WhatsApp provider**. A message is
sent only when ALL of these hold: a template exists for the event,
WhatsApp is configured for the tenant, and the recipient has a **phone
number** with **WhatsApp opt-in**. Every attempt is logged (sent/failed) in
the notification log.

## Providers

Configured per tenant by platform support (visible read-only under
Settings → Integrations):

- **Twilio WhatsApp** — sends from the tenant's Twilio WA number.
- **Meta WhatsApp** (WhatsApp Business Cloud API).

No provider configured ⇒ nothing is sent; the rest of the platform works
normally.

## The Templates tab

One card per event, each with a WhatsApp row and an email row, plus the
event's available variables shown as chips. Per row: **Add** (no template
yet) or **Edit**, then a body textarea (and a subject field for email).
Placeholders use square brackets: `Hi [client_name], see you on [date] at
[time]!`. An unconfigured row means messages for that event/channel are
simply not sent.

> **Email status:** email templates can be written and saved, but email
> *dispatch is not yet wired* — only WhatsApp messages actually send today.
> Don't promise email delivery.

## Events and their variables

| Event | Fires when | Variables |
|---|---|---|
| `booking_confirmed` | Booking accepted / auto-confirmed / manual booking with notify ticked | `[client_name] [staff_name] [date] [time] [duration] [agency_name]` |
| `booking_declined` | Staff/owner declines a pending booking | `[client_name] [staff_name] [date] [time] [agency_name]` |
| `booking_reminder` | Reminder lead time before a confirmed slot | `[client_name] [staff_name] [date] [time]` |
| `booking_cancelled` | Confirmed booking cancelled | `[client_name] [staff_name] [date] [agency_name]` |
| `client_approved` | Owner approves a client account (account mode) | `[client_name] [agency_name]` |

## Reminders

A platform cron runs **every 5 minutes** and sends the `booking_reminder`
WhatsApp for confirmed bookings whose start time is within the tenant's
**Reminder lead time** (Settings → Bookings, in minutes). Each booking gets
at most one reminder — it is marked sent even if WhatsApp delivery failed,
to avoid spam retries. A reminder set to 60 means "about an hour before",
with up to 5 minutes of cron granularity.

## In-app notifications (owner feed)

Separate from client messaging, the owner gets dashboard notifications for:
new booking requests, new client signups (account mode), no-shows, staff
going offline, and staff flagging a client. These are internal only —
nothing is sent to clients.

## Common owner questions

- *"Client got no confirmation"* — check in order: WhatsApp shows
  Configured under Settings → Integrations; a `booking_confirmed` WhatsApp
  template exists; the client gave a phone number and opted in; the booking
  was actually confirmed (pending bookings only message on accept/decline).
- *"Reminder came too late/early"* — adjust Reminder lead time under
  Settings → Bookings; remember the ±5 min cron granularity.
- *"Can I send a custom message to one client?"* — not from the platform;
  use your own WhatsApp. Templates fire only on events.
- *"Different language?"* — write the template bodies in any language you
  like; there is one template per event, not per locale.

## Related APIs (for tool integration)

- `GET /api/{slug}/notifications/templates` — templates + variables +
  event/channel lists (agent).
- `POST /api/{slug}/notifications/templates` — upsert one template
  (event_type, channel, subject?, body) (agent).
