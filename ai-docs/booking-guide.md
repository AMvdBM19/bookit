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

A **List / Calendar / Board** toggle sits in the tab header, with a
**keyword search** (client, staff, notes, booking id) and a **date-range
filter** (today / tomorrow / this & next week / this month / custom) that
apply to all three views. A **Filters** button opens a collapsible bar with
more filters that also apply to every view: **{staff}** (a specific member or
"Unassigned (pool)"), **Status** (multi-select chips: pending, confirmed,
completed, no-show, cancelled), **Source** (widget / manual) and **Payment**
(unpaid / deposit paid / paid). The button shows a count of active filters;
**Clear filters** resets them.

The **Calendar** is a read-only week or day grid (hour rows × day
columns): blocks are colored by status, pool/unassigned bookings show a
dashed outline, clicking a block opens the detail panel, and
right-click / long-press opens a quick-action menu (assign, complete,
no-show, cancel, **reschedule**, edit, details). When a specific {staff} is chosen in the Filters bar, the
calendar **shades that member's availability**: their scheduled working hours
show clear, hours outside their schedule are hatched, and days off are tinted
with a "Day off" label.

A **Single staff ⇄ All staff** toggle sits in the calendar header. **All
staff** switches to a single-day view with **one column per active {staff}**:
working hours show **clear**, out-of-hours and unscheduled days show a clearly
**greyed/hatched** "Outside working hours" band (a column with no schedule that
day is labelled "Not scheduled"), days off are **red-tinted with a "Day off"
label**, and a **red line marks the current time** on today. Booking blocks
show the **time range, {client} and service**, colored by status; clicking one
opens the detail panel. All toolbar filters (staff, status, date range, source,
payment, search) apply to these blocks. Use ‹ / › to move day by day, and the
view scrolls horizontally on narrow screens. Clicking an empty spot inside a
working column opens the manual-booking form prefilled with that {staff}, date
and time. (Each {staff} member's schedule/day-off info for the date is fetched
once and cached for the session.)

The **Board** is a Kanban: columns for pending → confirmed → completed /
no-show / cancelled (the last three collapsed by default) with counts.
Drag a card between columns to change status — only valid, time-gated
transitions are allowed (invalid drops snap back with a message). Each
card has the same quick actions as the calendar menu.

The **List** view has three sections:

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
WhatsApp opt-in), the booking notes, the service address, a clickable
reference-image thumbnail, and any **custom booking-form fields** the tenant
collects (managed in Widget → Booking form fields), selected services with per-service
extras and the total price, the assigned {staff} (or "Unassigned — pool"),
the source (Widget/Manual), and requested/confirmed/cancelled timestamps
plus cancellation reason. Staff see a slimmer "See details" on their own
booking cards (full notes, source, requested time — no client contact
details or pricing).

The **Export CSV** button downloads all bookings (see data-export-guide.md).
The **+ New** button opens manual creation.

## Editing a booking

The detail panel has an **Edit** button (owner always; staff only on their
own bookings and only when Settings → Staff permissions → "Staff can edit
bookings" is on). The edit modal changes **services** (checklist),
**notes**, and the **total price** — the price recomputes from base rate +
service extras as services change, and can be overridden manually; a price
change asks for confirmation. Date, time and staff assignment can NOT be
changed (no rescheduling). Editing is allowed on pending, confirmed, and
completed-within-24-hours bookings. Edited bookings show an **Edited**
badge and timestamp in the detail panel, and every edit is stored in an
audit trail (who, when, what changed). Clients are not notified of edits.

## Rescheduling a booking

Rescheduling moves a booking to a **new date/time** and optionally reassigns
it to **another {staff}** — separate from Edit (which only changes services,
notes and price). It is **owner-only** and available on **pending** and
**confirmed** bookings via a **Reschedule** action in the detail panel, the
Board card, and the calendar quick-action menu.

The reschedule modal lets the owner pick a {staff}, a new date, and a free
time slot (slots come from the same availability engine the widget uses, so
only genuinely open times appear). The new slot keeps the booking's existing
duration. The server re-checks availability — excluding the booking itself,
so moving it a little within the same window is allowed — and rejects a
conflicting slot with a clear message (the modal stays open so another slot
can be picked). On success the booking's status is unchanged, the {client}
receives a **booking_rescheduled** notification (email + WhatsApp), and the
booking shows a **Rescheduled** badge. Every reschedule is recorded in the
edit audit trail.

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
- **Service address**: shown only when the tenant's booking form has the
  address field enabled (Widget → Booking form fields); optional here.
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

A booking an administrator assigned to a staff member shows an **"Assigned by
admin"** label on the staff member's card, and that staff member **cannot
cancel it** — only an administrator can (the cancel attempt returns a 403).
Bookings a client chose them for, or that they claimed from the pool, are not
restricted this way.

## Widget booking flow (what the client experiences)

1. **Browse** — pick a staff member (skipped in pool mode or when only one
   staff member exists).
2. **Date & time** — date chips for the next 14 days; available slots load per
   date. Slot length = `default_slot_minutes`, or the sum of selected services'
   durations when per-service duration is enabled (services without a custom
   duration count as the default appointment length in that sum).
3. **Details** — name, email, phone, service selection, notes (label and
   required-ness are template-driven), age confirmation when the age gate is on.
   Any **custom booking-form fields** the owner has defined appear here
   (managed in Widget → Booking form fields). These include built-in
   **service address** (for at-home services) and **file upload** fields. A
   file-upload field accepts JPEG/PNG/WebP/PDF/DOC/DOCX (max 5 MB) and shows no
   hint unless the owner sets help text.
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

## Charging at a terminal & receipts (Phase 18)

In a booking's expanded detail panel, when a balance is outstanding and the
tenant has at least one active Mollie PIN terminal registered (settings-guide.md):

- **Charge to terminal** — starts a card payment on the reader for the
  remaining balance (total minus any deposit already paid), or the full total
  if nothing was prepaid. With more than one terminal, a selector appears
  first. The owner completes the payment on the physical reader; Mollie's
  webhook then flips the booking to **Paid**.
- **Download receipt** — appears once a booking is fully **Paid**. Opens a
  styled HTML receipt in a new tab (with a Print / Save-as-PDF button) showing
  services, totals, the amount paid and method, and — when a tax rate is set —
  a BTW breakdown (subtotal excl., BTW, total incl.). A receipt is explicitly
  *not* a tax invoice.

When a booking becomes fully paid, the **Receipt** email template
(`payment_receipt`) is sent automatically if email is active.

## Related APIs (for tool integration)

- `POST /api/{slug}/bookings/{id}/charge-terminal` — charge the balance to a
  PIN terminal (agent/staff). Body `{ terminal_id? }`.
- `GET /api/{slug}/bookings/{id}/receipt` — styled HTML receipt (agent/staff).
- `GET /api/{slug}/bookings?status=&from=&to=` — list (agent).
- `POST /api/{slug}/bookings/{id}/accept|decline|assign|claim` — transitions.
- `PATCH /api/{slug}/bookings/{id}/status` — completed / no_show.
- `POST /api/{slug}/bookings/create` — manual creation (agent).
- `GET /api/{slug}/export/bookings` — CSV export (agent).
- `GET /api/{slug}/bookings/{id}/reference-image` — signed URL for the
  private reference image (agent, or the assigned staff member).
- `GET|PATCH /api/{slug}/bookings/{id}/edit` — edit context / apply an
  edit (agent; staff when staff_can_edit_bookings and own booking).
- Public: `GET /book/{slug}/api/availability`, `/pool-availability`,
  `POST /book/{slug}/api/book`, `POST /book/{slug}/api/reference-upload`.
