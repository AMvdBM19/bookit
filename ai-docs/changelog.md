# Book-IT Changelog

> Feature history for the AI assistant: what exists and since when. Newest
> first. Maintained per the AI Docs Maintenance Protocol in CLAUDE.md.

## 2026-06-15 — Embed guides & WordPress plugin (Phase 18-C/D)

- New **Book-IT Booking Widget** WordPress plugin: `[bookit slug lang height]`
  shortcode, a Gutenberg block, and a settings page for a default slug.
  Downloadable from the Widget tab (`/downloads/bookit-booking-widget.zip`).
- Per-platform embed guides in `public/docs/embed-guides/` (WordPress, Shopify,
  Wix, Squarespace, Webflow, Jimdo, Google Business Profile,
  Facebook/Instagram) + `ai-docs/embed-guide.md`.

## 2026-06-15 — POS terminal settlement & receipts (Phase 18-A/B)

- **Charge to terminal**: register Mollie PIN terminals under Settings →
  Payments, then charge a booking's outstanding balance (total minus paid
  deposit) or full total to the reader from the booking detail panel. Mollie's
  webhook settles the booking to **Paid**.
- **Receipts**: a `payment_receipt` email is sent when a booking becomes fully
  paid, and a **Download receipt** button opens a styled HTML receipt (with a
  BTW breakdown when a tax rate is set). A receipt is not a tax invoice.

## 2026-06-14 — Analytics tab (Phase 17-D)

- New **Analytics** dashboard tab: period selector (7/30/90 days), five
  KPI cards (total bookings, revenue, completion rate, no-show rate, avg
  per staff) and four charts (bookings by day, revenue by week, source
  split, status distribution). Read-only, derived from bookings; empty
  tenants show an empty state. "Projections coming soon" — no forecasting
  yet.

## 2026-06-14 — Booking board, search & date filter (Phase 17-C)

- The Bookings tab gains a **Board** (Kanban) view alongside List and
  Calendar: status columns with counts, drag-and-drop status changes
  (validated against the booking lifecycle and time-gated), and per-card
  quick actions (assign, complete, no-show, cancel, edit, details).
- A **keyword search** and a **date-range filter** (today / tomorrow /
  this & next week / this month / custom) apply across all three views.
- The Calendar view gains a right-click / long-press **context menu** with
  the same quick actions.

## 2026-06-14 — Online deposit payments via Mollie (Phase 17-B)

- Tenants can connect **Mollie** (Settings → Integrations → Payments) to
  collect deposits online. When a booking that requires a deposit is
  confirmed, the client gets a payment link (in the confirmation
  email/WhatsApp and on the success screen) and a Mollie checkout.
- A webhook marks the deposit paid and emails a **payment received**
  confirmation; the dashboard shows payment status on bookings (detail
  panel + table badges) with a copy-payment-link action.
- No key configured ⇒ nothing changes; bookings confirm exactly as before.

## 2026-06-14 — Cancellation notifications (Phase 17-A)

- Cancelling a booking now notifies the client (WhatsApp if opted in,
  email if active) — previously cancellations were silent.

## 2026-06-13 — Widget in Dutch (Phase 16-C)

- The public booking widget can run in **Dutch**: Widget tab → Language →
  Nederlands → Save & Apply. Translates the interface (labels, buttons,
  validation, success screen, date/number formats) while the tenant's own
  terminology, service names and notes labels stay exactly as typed.
  Default remains English — nothing changes for existing tenants.
- `?lang=en|nl` on the widget URL overrides the saved language (testing /
  embeds); the customizer's live preview follows the selector.

## 2026-06-13 — Email notification channel (Phase 16-B)

- Booking confirmations, declines, cancellations and reminders can now go
  out by **email** alongside WhatsApp, using the email templates that
  already existed on the Templates tab. Self-service enablement under
  Settings → Integrations → Email (sender display name, optional
  reply-to, Active toggle); not configured = nothing changes.
- Confirmation emails attach an .ics calendar invite and can include the
  booked services via the new `[services]` placeholder (email only).
- Emails carry the tenant logo and brand color in a minimal layout with a
  "Sent via Book-IT" footer; the From header reads "{sender name} via
  Book-IT".

## 2026-06-13 — Tax card is read-only (Phase 16-A)

- The Pricing tab's Tax card no longer offers editing: tax rate, tax
  label and tax period are locked (set during onboarding, changed via
  support only). Previously the card showed editable fields whose Save
  always failed with "Field is locked".

## 2026-06-12 — Booking editing (Phase 15-B7)

- Bookings can now be edited (services, notes, price) from the detail
  panel's Edit button. Owners always can; staff can edit their own
  bookings when the new "Staff can edit bookings" toggle (Settings →
  Booking form) is on. Price recomputes from base rate + extras with a
  manual override; price changes require confirmation. Allowed on
  pending, confirmed, and completed-within-24h bookings; no
  rescheduling. Edits show an "Edited" badge and are stored in an audit
  trail. Planned `edit_booking` assistant tool documented.

## 2026-06-12 — Templates tab redesign (Phase 15-B6)

- The Templates tab now navigates by event dropdown → WhatsApp/Email
  sub-tabs → one editor, with a configured-status badge, click-to-insert
  placeholder chips, a live preview with sample values, and a confirmed
  "Reset to default" that loads standard wording. Same templates API
  underneath — existing templates are untouched.

## 2026-06-12 — Conditional booking fields: reference image + address (Phase 15-B5)

- The booking widget can now collect a **reference image** (optional
  upload, private storage, viewed via the booking detail panel) and/or a
  required **service address**, controlled per tenant in Settings →
  Booking form. Reference image is on by default for tattoo-template
  tenants. The manual booking modal gets an optional address field when
  the address flag is on.

## 2026-06-12 — Staff photo upload (Phase 15-B4)

- Staff profile photos can now be uploaded directly (JPEG/PNG/WebP, max
  5 MB, up to 6 photos) instead of URL-only. The Photos block appears in
  the staff setup wizard's Profile step and in the staff dashboard's
  profile editor; a URL input remains as fallback. Removing a photo also
  deletes the uploaded file. The first photo shows on the booking widget.

## 2026-06-12 — Getting-started checklist rework (Phase 15-A3)

- The dashboard checklist now has three steps: add a team member,
  customize the widget (done once a theme is actually saved) and share
  the booking link (copies the URL). Dismissing asks for confirmation,
  and a dismissed checklist can be re-opened from Settings → "Getting
  started". While loading it shows a skeleton instead of disappearing.

## 2026-06-12 — Pricing tab shows per-booking prices (Phase 15-A2)

- The Pricing tab's base rate now displays and edits in the tenant's own
  appointment length ("€40 per 60-min booking") with the stored
  per-30-minutes equivalent as a muted helper line. Storage is unchanged —
  the platform still keeps a per-30-min rate.
- Sections reordered: Base Pricing, Services & Pricing (renamed from
  Per-Service Pricing and moved up), Deposits, Tax (rate shows a Locked
  tag), Revenue Split, No-Show Policy.

## 2026-06-12 — Zero values respected in setup wizard (Phase 15-A1)

- The setup wizard's Financial step now stores 0 correctly for the base
  rate, staff payout %, tax rate % and minimum lead time (previously a 0
  was silently replaced by the default, e.g. base rate 0 became 60). A
  base rate of 0 means free bookings or consultations; the wizard says so
  under the field.

## 2026-06-12 — Revenue split slider (Phase 14-B3)

- The Pricing tab's Revenue Split section shows a 0–100 range slider for
  the staff payout (agency share auto-computed as the complement), in sync
  with the numeric inputs. Disabled with a Locked tag when the split is
  wizard-locked (the normal case). The setup wizard's Financial step also
  uses the slider.

## 2026-06-12 — Calendar view on the Bookings tab (Phase 14-B2)

- New List ⇄ Calendar toggle on the Bookings tab. Week and day views
  (hour grid), bookings colored by status, dashed outline for
  pool/unassigned, click opens the booking detail panel. Read-only — no
  drag-to-reschedule yet.

## 2026-06-12 — Widget month calendar for far-ahead bookings (Phase 14-B1)

- The widget's 14-day date strip is replaced by a month-grid calendar with
  month navigation, bounded by the minimum lead time and the tenant's max
  booking window (out-of-range days disabled). Time-slot chips unchanged.

## 2026-06-12 — Self-service WhatsApp integration setup (Phase 14-A11)

- Settings → Integrations is interactive: a **Configure** button opens a
  WhatsApp modal (Twilio sender number, or Meta phone number ID + optional
  WABA ID, plus an Active toggle). Status shows as a badge: Not configured
  / Active (Twilio) / Active (Meta). Platform tokens stay env-managed.
- AI assistant and Email notifications render as intentional "Coming soon".

## 2026-06-12 — Per-service duration actually works + wizard toggle (Phase 14-A10)

- Root cause fixed: a server-side data cache served a frozen copy of
  tenant settings to the availability APIs, so enabling per-service
  duration never took effect until a redeploy. Toggling it now applies on
  the next widget load (same fix as the customizer staleness).
- The setup wizard's Booking Configuration step gained a **"Services have
  different durations"** checkbox so new tenants can enable it during
  onboarding (default off). Per-service durations are then set on the
  Pricing tab.

## 2026-06-12 — Currency and base rate now tenant-editable (Phase 14-A9)

- The Pricing tab's Base Pricing section lets the owner edit **currency**
  and **base rate per 30 min**. Saving asks for confirmation and applies
  to future bookings only — historical amounts are never converted or
  recalculated. Tax rate and revenue split percentages remain locked.

## 2026-06-12 — Getting-started checklist ends on widget customization (Phase 14-A8)

- The checklist's closing step is now **Customize your widget**, deep-
  linking to the Widget tab (which also holds the booking link and embed
  code). The separate "Share your booking link" copy step was removed.

## 2026-06-12 — Booking rows expand into a full detail panel (Phase 14-A7)

- All three Bookings-tab tables (pending / upcoming / past) gained a
  chevron per row that expands client contact (email, phone, WhatsApp
  opt-in), booking notes, services + per-service extras + total price,
  assigned staff or pool status, source, and lifecycle timestamps.
- Staff booking cards gained a slimmer "See details" (full notes, source,
  requested time) — client contact details and pricing stay agent-only.

## 2026-06-12 — Brand color set in onboarding only (Phase 14-A6)

- Platform-side tenant creation no longer picks a brand color; the owner
  chooses it in the setup wizard's Branding step and can change it later
  in Settings. (No change to tenant-facing flows.)

## 2026-06-12 — Staff roster: honest activation actions (Phase 14-A5)

- The misleading **Activate** button is gone for staff who haven't
  completed their profile wizard — the row now shows an "Awaiting profile
  setup" hint (staff activate themselves by finishing onboarding).
- **Reactivate** remains for previously active, deactivated staff. The
  API also rejects activating un-onboarded staff.

## 2026-06-12 — Staff social links reliable on the widget (Phase 14-A4)

- Widget staff cards now render a clickable icon for every filled-in
  social link, whether staff entered a bare handle, an @handle, or a full
  URL. The icon links to the canonical profile (instagram.com/handle etc.).
- Empty link inputs are no longer stored; the social row is hidden when a
  staff member has no links. Existing data was cleaned up.

## 2026-06-12 — Widget customizer saves now apply immediately (Phase 14-A3)

- Saving in the Widget customizer is reflected on the live `/book/{slug}`
  widget on the next page load. Previously a server-side data cache could
  serve the old theme until the platform was redeployed.

## 2026-06-12 — Tenants fully own their service tags (Phase 14-A2)

- New **+ Add service** button, inline rename, and delete (with
  confirmation) on the Pricing tab's Per-Service Pricing table. Services
  with booking history can't be deleted — deactivate instead.
- Super admin has no per-tenant service-tag editing surface (template seed
  tags and template-reset stamping are unchanged).

## 2026-06-12 — Calendar links fixed + ICS download (Phase 14-A1)

- Add-to-calendar links on booking rows/cards now always open Google
  Calendar's universal event template (a malformed time format previously
  bounced some users to the Google Workspace landing page).
- New download-`.ics` icon next to the Google Calendar icon on agent
  booking rows and staff booking cards, for Apple Calendar / Outlook users.

## 2026-06-11 — Audit hotfix (Phase 13 post-deployment audit)

- ai-docs knowledge base is now bundled into the Docker runtime image (the
  assistant's doc loader can read it in production).
- Per-service duration sum now counts services *without* a custom duration
  as the default appointment length (previously they contributed 0
  minutes), consistently across both availability APIs and the widget.
- The booking API now rejects submissions whose slot length doesn't match
  the selected services' total duration (409), closing a tampered-client
  underblocking/underpricing gap. No behavior change when per-service
  duration is off.

## 2026-06-11 — Tier 1 "Ship It" Polish Sprint

- **Group 10 — AI assistant foundation**: this `ai-docs/` knowledge base,
  `lib/ai/` provider/tool/context skeleton, reserved
  `POST /api/{slug}/assistant` endpoint (403 when disabled, 501 until a
  provider ships). No user-facing assistant yet.
- **Group 9 — CSV export**: Export CSV buttons on the Bookings, Staff and
  Clients tabs (see data-export-guide.md).
- **Group 8 — Staff days off UI**: days-off (exceptions) manager — calendar
  icon per staff row for the owner, same manager on the staff dashboard;
  dates fully block availability.
- **Group 7 — Buffer time**: Buffer before/after minutes (0–60) under
  Settings → Bookings; expands each booking's blocked range in
  availability.
- **Group 6 — Per-service duration**: toggle on the Pricing tab's
  Per-Service Pricing table; each service can set its own appointment
  length, widget sums selected services' durations.
- **Group 5 — Post-wizard onboarding checklist**: dashboard checklist
  guiding new owners (add staff, configure templates, share the widget…).
- **Groups 1–4 — UI polish**: shared UI components (Badge, Button, Modal,
  Spinner), toast notifications on every action, loading spinners and
  empty states across all tabs, confirmation dialogs for destructive
  actions (deactivate staff, block guest, no-show, delete day off).

## 2026-06-10 — Phase 12A: Widget customizer

Widget dashboard tab: CSS-variable theming, 8 presets, live preview with
mobile/desktop toggle, custom colors/corners/cards/spacing, powered-by
toggle, widget logo, embed code export (WordPress shortcode / iframe /
script).

## 2026-06-10 — Phase 11C: Pool booking mode

`booking_mode=pool` tenants: widget skips staff selection, availability is
the union of eligible staff, bookings land unassigned as pending; staff
claim first-come-first-served or the owner assigns from the Bookings tab.

## 2026-06-09 — Phase 11B: Manual booking creation

**+ New** on the Bookings tab: client search or new guest, optional
off-grid date/time, services, auto-suggested overridable price, status
Pending/Confirmed/Completed (backfill), optional WhatsApp notify.

## 2026-06-09 — Phase 11A: Booking status lifecycle

`completed` and `no_show` statuses with Mark buttons after the slot passes;
`source` column (client_request/manual); `booking_completion_by` flag lets
staff complete their own bookings; cancellation dispatch.

## 2026-06-09 — Light/dark theme + responsive polish

Theme toggle across dashboards, auth and widget; responsive layout pass.

## 2026-06-08 — Phase 10C (+ fixes)

Catalog caching fix (force-dynamic), deposits behind the
`deposits_supported` flag, logout, add-to-Google-Calendar buttons, widget
price breakdown, staff dashboard self-editing, staff login fix, HH:MM time
format, root slug redirect.

## 2026-06-06 — Phase 10B-1: Pricing & Finances

Pricing tab: pricing_enabled, tax (rate locked, label/period editable),
linked revenue split, no-show revenue policy, per-service extra prices;
currency/base rate/tax rate locked after onboarding.

## 2026-06 — Phase 10A: Data-driven industry templates

`industry_templates` + `tenant_config` replace the hardcoded vertical
system: terminology, feature/compliance flags and default settings are
stamped from a template at tenant creation; wizard redesigned with a
template picker step; super-admin Templates tab.

## Earlier phases (pre-June 2026)

- **Phase 9** — widget polish, deposit notice scaffold, IP rate limiting on
  booking creation, editable settings (PATCH + locked fields).
- **Phase 8** — super admin console (Tenants/Templates, API-key auth).
- **Phase 7** — reminder cron (every 5 min), notification templates tab,
  cancellation dispatch.
- **Phase 6** — agent ERP dashboard: bookings, staff, guests/clients,
  settings tabs.
- **Phase 5** — public booking widget (guest + account mode) and the
  booking engine (availability, lead time, booking window).
- **Phase 4** — staff flow: creation, forced password change, 4-step setup
  wizard, WhatsApp dispatch, calendar links.
- **Phase 3** — agent onboarding wizard.
- **Phase 2** — auth, tenant resolution by slug, route shell.
- **Phase 1** — repo, multi-tenant schema, seed tenants.
