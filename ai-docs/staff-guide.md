# Staff Guide

> How team members (the tenant's "staff" — Artists, Stylists, Technicians,
> depending on terminology) are created, set up, scheduled, and managed.

## Creating a staff member (owner)

Dashboard → **Staff** tab → **+ Add {staff}** button. The modal asks for:

- **Email** — becomes their login.
- **Display name** — their public pseudonym shown to clients in the widget.
  Some templates (e.g. adult services) *require* a pseudonym distinct from the
  real name (`staff_require_pseudonym` flag).
- **Initial password** — minimum 8 characters. The owner shares this with the
  staff member; they are **forced to change it on first login**.

After creation the staff member appears in the roster with an **Invited**
badge until they log in and complete their setup wizard.

## Staff setup wizard (staff member, first login)

After changing their password, a new staff member runs a 4-step wizard at
`/{slug}/staff-setup`:

1. **Profile** — pseudonym, bio, and optional personal details (gender,
   nationality, age, languages, social links). Which fields appear is
   template-driven.
2. **Schedule** — weekly working hours: pick weekdays and a start/end time per
   day. This is the base layer of their availability.
3. **Services** — pick which of the tenant's service tags they offer. Only
   staff offering a selected service appear/are eligible for it in the widget.
4. **Review** — confirm and finish.

Until the wizard is complete the roster shows **Setup pending** and the staff
member does not appear in the booking widget.

## The Staff tab (owner dashboard)

Roster table columns: **Name** (photo/initial, pseudonym, real name), **Status**
(active / inactive / offline badge), **Profile** (Invited / Complete / Setup
pending), **Tags** (first 3 service tags, then "+N"), **Schedule** (working
weekdays, e.g. "Mon Tue Fri"), **Created**, **Actions**.

Per-row actions:

- **Days off** (calendar icon) — opens the "Days off — {name}" modal (below).
- **Deactivate / Activate** — deactivating asks for confirmation and removes
  the person from the booking widget and from receiving new bookings.
  **Existing bookings are not affected.** Never delete — deactivate.

Header buttons: **Export CSV** (roster export, see data-export-guide.md) and
**+ Add {staff}**.

## Days off (exceptions)

Days off are single-date exceptions that override the weekly schedule — the
staff member shows no availability at all on those dates.

- **Owner:** Staff tab → calendar icon on the staff row → add a **date** plus
  an optional **reason** (internal note), or delete an upcoming day off
  (with confirmation).
- **Staff member:** the same days-off manager appears on their own dashboard.

Each exception records who created it (staff or agent). Days off are the #1
answer to "why does X have no slots on that date".

## Staff dashboard (what staff see)

Staff log in at `/{slug}/login` like the owner, but get a simpler dashboard:

- **Available {bookings}** — pool-mode only: unassigned bookings matching
  their services; first to Accept claims it.
- **Pending requests** — bookings assigned to them; Accept / Decline.
- **Upcoming this week** — confirmed bookings. If the tenant's
  `booking_completion_by` flag is `staff_and_admin`, staff can also mark
  past bookings **completed** or **no-show**.
- **Profile** — they can edit their own pseudonym, bio, details, social
  links, service tags, and weekly schedule directly from the dashboard.
- **Days off** — add/remove their own exception dates.

Staff never see other staff members' bookings, the client list, pricing,
or tenant settings.

## Availability: how the three layers combine

A staff member is offered to clients on a given date/time when:

1. Their **weekly schedule** covers that weekday and time range.
2. No **day off** exists for that date.
3. No pending/confirmed **booking** (expanded by the tenant's buffer
   before/after minutes) overlaps the slot.

## Common owner questions

- *"My new staff member doesn't show in the widget"* — check: status is
  Active, Profile shows Complete (wizard finished), and they have at least
  one weekday in their schedule.
- *"How do I give someone a vacation?"* — add one day-off exception per date
  via the calendar icon on their row. There is no date-range input yet; add
  each day individually.
- *"Can I edit a staff member's schedule for them?"* — not from the Staff
  tab; schedules are owned by the staff member in their own dashboard. The
  owner can manage their days off.
- *"Staff member left"* — Deactivate (do not delete). Their history and past
  bookings remain intact.

## Related APIs (for tool integration)

- `GET /api/{slug}/staff` — roster (agent).
- `POST /api/{slug}/staff/create` — create staff (agent).
- `PATCH /api/{slug}/staff/{id}/status` — activate/deactivate (agent).
- `GET|POST /api/{slug}/staff/{id}/exceptions`,
  `DELETE /api/{slug}/staff/{id}/exceptions/{exceptionId}` — days off
  (agent, or the staff member themselves).
- `GET|PATCH /api/{slug}/staff/profile`, `/api/{slug}/staff/schedule`,
  `/api/{slug}/staff/tags` — staff self-service.
- `GET /api/{slug}/export/staff` — CSV export (agent).
