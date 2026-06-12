# Book-IT Platform Overview

> Audience: an AI assistant advising a business owner (the "agent" role) who runs
> their appointment business on Book-IT. Use this file to understand what the
> platform is and how its concepts fit together before consulting the
> feature-specific guides.

## What Book-IT is

Book-IT is a multi-tenant appointment booking platform. Each business (a
**tenant**) gets:

- A public **booking widget** at `/book/{slug}` where clients book appointments
  without logging in (or with an account, depending on configuration).
- A private **dashboard** at `/{slug}/dashboard` where the owner manages
  bookings, team members, clients, pricing, the widget's look, notification
  templates, and settings.
- A separate, simpler dashboard for each **staff member** (team member) to
  manage their own profile, schedule, days off, and incoming bookings.

One codebase serves every industry. The vocabulary and feature set adapt per
tenant through **industry templates** — e.g. a tattoo studio calls staff
"Artists" and bookings "Sessions", a beauty salon calls them "Stylists" and
"Appointments". When advising a user, always use *their* terminology (available
from their tenant configuration), not the internal names.

## Core concepts and roles

| Concept | Internal name | What it means |
|---|---|---|
| Business owner | `agent` | Full dashboard access. One per tenant in practice. |
| Team member | `staff` | Provides the service. Has own login, profile, schedule, days off. |
| Customer | `client` (account mode) or `guest_client` (guest mode) | Books via the widget. |
| Appointment | `booking` | Has a date, start/end time, status, optional staff, optional service tags. |
| Service | `service_tag` | A bookable service type with optional extra price and optional own duration. |
| Super admin | platform operator | Manages tenants and industry templates. Not a tenant role. |

## Client modes

Set per tenant at creation, not editable by the owner:

- **Guest mode** — clients book with just name + email (+ optional phone). They
  are deduplicated by email into `guest_clients`. Owners can block a guest
  email from making new bookings.
- **Account mode** — clients register and log in. The owner approves, suspends
  or rejects accounts. Only approved clients can book.

## Booking confirm modes

- **staff_must_accept** — a new booking lands as `pending_staff`; the assigned
  staff member (or the owner) accepts or declines it.
- **auto_confirm** — bookings are confirmed instantly.

## Booking modes (who the client books)

- **staff_select** (default) — the client picks a specific staff member in the
  widget, then sees that person's availability.
- **pool** — the client picks only a date/time (optionally filtered by
  service); the booking lands unassigned and any eligible staff member can
  claim it, or the owner assigns it.

## Booking lifecycle

```
pending_staff ──accept──▶ confirmed ──after the slot──▶ completed | no_show
      │                        │
   decline                  cancel
      ▼                        ▼
  cancelled                cancelled
```

Bookings can come from the widget (`client_request`) or be created manually by
the owner from the dashboard (`manual`), including off-grid times.

## Availability engine

A staff member is bookable on a given date when all three layers pass:

1. **Weekly schedule** (`staff_schedule`) — recurring working hours per weekday.
2. **Exceptions** (`staff_exceptions`) — explicit days off override the schedule.
3. **Existing bookings** — pending or confirmed bookings block their time slot;
   each booking's blocked range is expanded by the tenant's optional
   **buffer before/after** minutes (prep/cleanup time).

Free intervals are then cut into discrete slots of the tenant's
`default_slot_minutes` — or, when **per-service duration** is enabled and the
client has picked services, the sum of the selected services' durations.

## The dashboard tabs (agent view)

| Tab | Purpose | Guide |
|---|---|---|
| Bookings | Pending/upcoming/past bookings, accept/decline/assign, manual creation, CSV export | booking-guide.md |
| Staff | Team roster, invite staff, activate/deactivate, days off, CSV export | staff-guide.md |
| Clients | Guest list or client accounts, block/approve/suspend, CSV export | client-guide.md |
| Pricing | Base pricing, tax, revenue split, deposits, no-show policy, per-service price + duration | pricing-guide.md |
| Widget | Booking page theming, live preview, embed code | widget-guide.md |
| Templates | WhatsApp/email notification templates | notifications-guide.md |
| Settings | Identity, booking rules, buffers, compliance, integrations | settings-guide.md |

## Getting started checklist

New owners see a dismissible **"Getting started"** card at the top of the
dashboard until its two steps are done: **Add your first team member**
(jumps to the Staff tab) and **Customize your widget** (jumps to the
Widget tab, where the booking link and embed code also live). It
disappears once completed or dismissed.

## Technical shape (for grounding, not for explaining to users)

- Next.js 14 App Router + Supabase (PostgreSQL with row-level security).
- All tenant-scoped APIs live under `/api/{slug}/...` and validate the caller's
  role and tenant from their JWT.
- Public widget APIs live under `/book/{slug}/api/...` with no auth and
  IP-based rate limiting on booking creation.
- WhatsApp notifications dispatch via Twilio or Meta, configured per tenant.
- A reminder cron sends booking reminders ahead of the slot.

## How to advise well

- Resolve every recommendation to a concrete place in the dashboard ("the
  Pricing tab", "Settings → Bookings"), using the tenant's own terminology.
- Distinguish tenant-editable settings from locked ones (locked fields were
  fixed during onboarding; changing them requires platform support).
  Currency and base rate are tenant-editable since Phase 14; tax rate and
  the revenue split remain locked.
- Features gated by template flags (deposits, age gate, pool mode, etc.) may
  simply not exist for this tenant — check the feature flags before suggesting
  them.
