# Notifications Guide

> WhatsApp + email messaging, the Templates tab, reminder timing, and the
> in-app notification feed.

## The pipeline in one paragraph

When a notifiable event happens (booking confirmed, declined, cancelled,
reminder due, client approved), the platform looks up the tenant's
**template** for that event + channel, fills in `[variable]` placeholders,
and sends it on each configured channel. **WhatsApp** sends only when: a
WhatsApp template exists, a WhatsApp provider is configured, and the
recipient has a **phone number** with **WhatsApp opt-in**. **Email** (for
booking events) sends only when: an email template exists, the tenant's
email integration is **Active** under Settings → Integrations, and the
recipient has an email address (always true — booking requires one). The
channels are independent: one failing never blocks the other. Every
attempt is logged (sent/failed) in the notification log.

## Channels

Configured under **Settings → Integrations**:

- **Twilio WhatsApp** — sends from the tenant's Twilio WA number.
- **Meta WhatsApp** (WhatsApp Business Cloud API).
- **Email** — self-service: the owner clicks Configure, sets a **sender
  display name** (inbox shows "{name} via Book-IT"), an optional
  **reply-to** address, and the Active toggle. Sending infrastructure is
  platform-managed (Resend); the owner never enters API keys.

No channel configured ⇒ nothing is sent on it; the rest of the platform
works normally. Booking-confirmed emails attach an **.ics calendar
invite** automatically.

## The Templates tab

Navigation is: **Event dropdown** (shows how many channels are configured
per event, e.g. "Booking confirmed (1/2 set)") → **channel sub-tabs**
(WhatsApp / Email, each with a green dot when configured) → a single
editor. The editor has:

- a body textarea (plus a subject field on the Email tab),
- an **Active / Not configured** status badge,
- **click-to-insert placeholder chips** — clicking `[client_name]` inserts
  it at the cursor,
- a live **preview pane** that fills placeholders with sample values,
- **Save template**, and **Reset to default** (asks for confirmation, then
  loads standard wording into the editor — nothing changes until Save).

Placeholders use square brackets: `Hi [client_name], see you on [date] at
[time]!`. An unconfigured event/channel means messages for it are simply
not sent.

## Events and their variables

| Event | Fires when | Variables |
|---|---|---|
| `booking_confirmed` | Booking accepted / auto-confirmed / manual booking with notify ticked | `[client_name] [staff_name] [date] [time] [duration] [services] [deposit_amount] [payment_link] [agency_name]` |
| `booking_declined` | Staff/owner declines a pending booking | `[client_name] [staff_name] [date] [time] [agency_name]` |
| `booking_reminder` | Reminder lead time before a confirmed slot | `[client_name] [staff_name] [date] [time]` |
| `booking_cancelled` | Confirmed/pending booking cancelled (now wired — Phase 17-A) | `[client_name] [staff_name] [date] [agency_name]` |
| `client_approved` | Owner approves a client account (account mode) | `[client_name] [agency_name]` |
| `payment_received` | A deposit payment is received (**email only** — no WhatsApp) | `[client_name] [deposit_amount] [date] [time] [agency_name]` |

`[deposit_amount]`/`[payment_link]` are filled only when a Mollie deposit
checkout was raised for the booking; otherwise empty. When a payment link
exists and your template doesn't include `[payment_link]`, the platform
appends a short "Deposit required / Pay here" line automatically so the
client always gets the link.

## Reminders

A platform cron runs **every 5 minutes** and sends the `booking_reminder`
(WhatsApp and email in one pass, per the channel rules above) for
confirmed bookings whose start time is within the tenant's **Reminder lead
time** (Settings → Bookings, in minutes). Each booking gets at most one
reminder — it is marked sent even if delivery failed on every channel, to
avoid spam retries. A reminder set to 60 means "about an hour before",
with up to 5 minutes of cron granularity.

> `[services]` note: on email it is filled with the booking's service
> names automatically; on WhatsApp it is not available and would appear
> literally — keep it out of WhatsApp bodies.

## In-app notifications (owner feed)

Separate from client messaging, the owner gets dashboard notifications for:
new booking requests, new client signups (account mode), no-shows, staff
going offline, and staff flagging a client. These are internal only —
nothing is sent to clients.

## Common owner questions

- *"Client got no confirmation"* — check per channel. WhatsApp: shows
  Configured under Settings → Integrations; a `booking_confirmed` WhatsApp
  template exists; the client gave a phone number and opted in. Email: the
  Email integration shows Active; a `booking_confirmed` email template
  exists. In both cases the booking must actually be confirmed (pending
  bookings only message on accept/decline).
- *"Where do replies to my emails go?"* — to the reply-to address set in
  the Email integration; without one the email is effectively no-reply.
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
- `GET|PUT /api/{slug}/integrations/email` — email integration state /
  enablement, sender display name, reply-to (agent).
