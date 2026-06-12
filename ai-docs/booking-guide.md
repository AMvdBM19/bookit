# Bookings Guide

> How appointments work in Book-IT: lifecycle, the Bookings tab, manual
> creation, pool mode, and the availability rules behind it all.

## Booking statuses

| Status | Meaning | How it's reached |
|---|---|---|
| `pending_staff` | Awaiting acceptance | New widget booking when confirm mode is `staff_must_accept`, any pool booking, or a manual booking saved as Pending |
| `confirmed` | Locked in, blocks availability | Accepted by staff/owner, auto-confirm mode, or manual booking saved as Confirmed |
| `cancelled` | Declined or cancelled | Decline (with optional reason sent to the client) |
| `completed` | Happened | Marked after the slot has passed |
| `no_show` | Client did not show | Marked after the slot has passed; affects revenue per the no-show policy |

Pending **and** confirmed bookings both block the time slot in availability.

## The Bookings tab (owner dashboard)

Three sections:

- **Pending requests** — every `pending_staff` booking. Per row the owner can
  **Accept**, **Decline** (with an optional reason that is sent to the client),
  or — for unassigned pool bookings — pick a staff member and **Assign**.
- **Upcoming (next 14 days)** — confirmed bookings. Once a booking's end time
  has passed, **Mark completed** / **Mark as no-show** buttons appear
  (no-show asks for confirmation). Each row has two add-to-calendar icons:
  one opens Google Calendar pre-filled, the other downloads a `.ics` file
  for Apple Calendar / Outlook. Staff see the same pair on their booking
  cards.
- **Past (last 30)** — history with status badges.

Every row in all three tables has a chevron ("See details") that expands an
inline panel showing, when present: {client} contact (email, phone,
WhatsApp opt-in), the booking notes, selected services with per-service
extras and the total price, the assigned {staff} (or "Unassigned — pool"),
the source (Widget/Manual), and requested/confirmed/cancelled timestamps
plus cancellation reason. Staff see a slimmer "See details" on their own
booking cards (full notes, source, requested time — no client contact
details or pricing).

The **Export CSV** button downloads all bookings (see data-export-guide.md).
The **+ New** button opens manual creation.

## Manual booking creation

The owner can create bookings directly — useful for phone/walk-in requests:

- **Client**: search existing clients/guests by name or email, or type a new
  name + email (creates a guest record in guest mode).
- **Staff**: pick a team member or leave Unassigned.
- **Date & time**: optional, and *off-grid* times are allowed — manual bookings
  are not restricted to the widget's slot grid and skip availability
  validation. Provide date, start and end together or not at all.
- **Services, notes, price**: price auto-suggests from base rate × duration +
  service extras, but can be overridden.
- **Status**: Pending, Confirmed or Completed (for backfilling history).
- **Notify**: optionally send the client a WhatsApp confirmation (requires a
  phone number and Confirmed status).

Manual bookings show a small "Manual" marker in lists.

## Staff view of bookings

Staff members see, on their own dashboard:

- **Available bookings** (pool mode) — unassigned bookings matching their
  services; first to **Accept** claims it.
- **Pending requests** — bookings assigned to them awaiting Accept/Decline.
- **Upcoming this week** — confirmed bookings; if the tenant allows staff
  completion (`booking_completion_by = staff_and_admin`), staff can mark
  completed / no-show after the slot passes.

## Widget booking flow (what the client experiences)

1. **Browse** — pick a staff member (skipped in pool mode or when only one
   staff member exists).
2. **Date & time** — date chips for the next 14 days; available slots load per
   date. Slot length = `default_slot_minutes`, or the sum of selected services'
   durations when per-service duration is enabled (services without a custom
   duration count as the default appointment length in that sum).
3. **Details** — name, email, phone, service selection, notes (label and
   required-ness are template-driven), age confirmation when the age gate is on.
   If changing services changes the appointment duration, the client is asked
   to re-pick a time slot.
4. **Confirm** — summary, optional price breakdown, optional deposit notice,
   submit.
5. **Success** — confirmation or "request submitted" message depending on
   confirm mode.

## Availability rules (when "no slots" questions come up)

A slot is offered when:

1. The staff member's weekly schedule covers it (Settings are per staff, set in
   their own dashboard or during their setup wizard).
2. The staff member has no **day off** (exception) on that date.
3. No pending/confirmed booking overlaps it — each existing booking's blocked
   range is widened by `buffer_before_minutes` / `buffer_after_minutes`.
4. It satisfies the tenant's `min_lead_time_hours` (e.g. no same-hour bookings)
   and `max_booking_days_ahead` window.

Common "why can't clients book X" answers: the staff member has no schedule for
that weekday, a day off exists, buffers around an adjacent booking consume the
gap, the lead-time minimum hides today's remaining slots, or the date is beyond
the booking window.

## Pool mode specifics

- The widget shows no staff list; clients pick only date/time (+ services).
- Availability is the union of all eligible staff (active, setup complete,
  offering at least one selected service when services are chosen).
- Pool bookings always start `pending_staff`, even in auto-confirm tenants.
- They are claimed first-come-first-served by staff, or assigned by the owner
  from the Bookings tab.

## Reminders and notifications

- Accept/decline/cancel events can trigger WhatsApp/email messages using the
  tenant's templates (see notifications-guide.md).
- A reminder is dispatched `reminder_lead_time_minutes` before confirmed
  bookings via the platform cron.

## Related APIs (for tool integration)

- `GET /api/{slug}/bookings?status=&from=&to=` — list (agent).
- `POST /api/{slug}/bookings/{id}/accept|decline|assign|claim` — transitions.
- `PATCH /api/{slug}/bookings/{id}/status` — completed / no_show.
- `POST /api/{slug}/bookings/create` — manual creation (agent).
- `GET /api/{slug}/export/bookings` — CSV export (agent).
- Public: `GET /book/{slug}/api/availability`, `/pool-availability`,
  `POST /book/{slug}/api/book`.
