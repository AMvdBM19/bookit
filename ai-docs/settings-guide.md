# Settings Guide

> Every field on the Settings tab, what it does, and which fields are locked.

## Locked vs editable

Some fields were fixed during onboarding (rows in `tenant_locked_settings`)
and show a **Locked** tag in edit mode. Attempts to change them are rejected
with "Field is locked"; changing them requires platform support. Typical
locked fields: **currency, base rate, tax rate**, and on some templates the
**minimum age**. Everything else saves immediately via the section's
Edit → Save flow.

## Identity section

| Field | Effect |
|---|---|
| **Display name** | Business name shown in the dashboard, widget and notifications (`agency_display_name`; falls back to the tenant name). |
| **Slug** | Read-only; part of every URL (`/{slug}/…`, `/book/{slug}`). |
| **Vertical** | Read-only; the industry template this tenant was stamped from. |
| **Logo URL** | Main logo (also the widget fallback logo). |
| **Brand color** | Hex color used as the dashboard accent. |

## Bookings section

| Field | Effect |
|---|---|
| **Confirm mode** | "{Staff} must accept" (new bookings wait as pending) vs **Auto-confirm** (instantly confirmed). Pool bookings always start pending regardless. |
| **Min lead time (h)** | Hides widget slots starting sooner than this many hours from now. |
| **Max booking window (days)** | How far ahead clients can book. |
| **Reminder lead time (min)** | How long before a confirmed booking the WhatsApp reminder fires (see notifications-guide.md). |
| **Buffer before (min)** | Prep time blocked *before* each booking. 0–60, steps of 5. |
| **Buffer after (min)** | Cleanup time blocked *after* each booking. 0–60, steps of 5. |
| **Client mode** | Read-only: guest or account (see client-guide.md). |

Buffers expand the blocked range of every pending/confirmed booking when
computing availability — they are the usual cause of "fewer slots than
expected" right after enabling them.

## Compliance section

Visibility of this whole area is template-driven; many tenants see only the
age gate.

| Field | Effect |
|---|---|
| **Minimum age** | Read-only (often locked); the age the client confirms. |
| **Age confirmation** | Checkbox: require clients to tick an "I am over N" box in the widget details step (`require_age_confirm`). |

Other compliance flags (KvK field, license, GDPR photo consent, terms
acceptance) are template-level notices, not tenant-editable.

## Legal section

| Field | Effect |
|---|---|
| **Terms & conditions URL** | Link shown to clients in the widget. When `require_terms_acceptance` is active, clients must tick a checkbox to confirm before submitting. |
| **Privacy policy URL** | Link shown alongside terms when both are set. If only the privacy URL is set (without mandatory acceptance), a subtle "Privacy policy" link appears below the submit button. |

## Integrations section

- **WhatsApp** — shows a status badge ("Not configured" / "Active
  (Twilio)" / "Active (Meta)") and a **Configure** button opening a modal:
  pick the provider, then enter the **WhatsApp sender number**
  (international format, Twilio) or the **Phone number ID** + optional
  WhatsApp Business Account ID (Meta), and an Active toggle. Platform API
  credentials (Twilio account, Meta access token) are managed by Book-IT;
  the owner never enters tokens. Without an active integration, no
  WhatsApp messages are sent (templates can still be edited and saved).
- **Email notifications** — status badge ("Not configured" / "Active")
  and a **Configure** button opening a modal: **sender display name**
  (clients' inboxes show "{name} via Book-IT"), optional **reply-to**
  address, and an Active toggle. By default emails go out via Book-IT's
  shared Resend infrastructure. To send from their own domain, the owner can
  optionally add their own **Resend API key** (masked after save) and a
  **sending domain**; the modal then shows guided **DNS setup steps**, a
  **domain verification status**, and a **Send test email** button. When a
  key + verified domain are set, emails are sent from
  `{sender}@{sending_domain}` using the tenant's own key. While not
  configured/active, no emails are sent and everything else works normally.
- **Payments (Mollie)** — status badge ("Not configured" / "Test mode" /
  "Active (Mollie)") and a **Configure** button opening a modal: the
  tenant's **Mollie API key** (a `test_…` key runs in test mode, `live_…`
  takes real payments; masked after save) and an Active toggle. When no
  tenant key is set, the platform's shared Mollie account is used if one
  is configured. With Mollie active, confirming a booking that requires a
  deposit raises an online checkout and a payment link for the client;
  see notifications-guide.md and pricing-guide.md (deposits). Without an
  active integration, no online payment is created and bookings confirm
  as normal.
- **AI assistant** shows as "Coming soon".

## Booking form section

The custom booking-form **field builder** has moved to the **Widget** tab, so
fields can be added and previewed live next to the booking widget. The Settings
page now shows a short pointer here. See widget-guide.md → "Booking form
fields".

## Staff permissions section

- **Staff can edit bookings** — lets team members edit services, notes
  and price on their own bookings from their dashboard (the owner can
  always edit). Every edit is recorded in an audit trail.

## Getting started section

- **Setup checklist** — a **Re-open checklist** button that brings the
  dismissed "Getting started" card back to the top of the dashboard.

## What lives on OTHER tabs (don't look for it here)

- Rates, tax, revenue split, deposits, no-show policy, per-service price &
  duration → **Pricing** tab.
- Widget colors, shape, logo, embed code → **Widget** tab.
- Message templates → **Templates** tab.

## Full editable-field list (PATCH /api/{slug}/settings)

Identity: `agency_display_name`, `logo_url`, `brand_color`.
Bookings: `booking_confirm_mode`, `min_lead_time_hours`,
`max_booking_days_ahead`, `reminder_lead_time_minutes`,
`buffer_before_minutes`, `buffer_after_minutes`.
Compliance: `require_age_confirm`.
Pricing: `pricing_enabled`, `show_price_to_client`, `staff_payout_pct`,
`agency_share_pct`, `tax_label`, `tax_period`, `no_show_revenue_policy`,
`no_show_partial_pct`, `per_service_duration_enabled`, and — only when the
template supports deposits — `deposit_pct`,
`deposit_required_above_minutes`.
Widget theme: all `widget_*` fields (never lockable).

Pricing (with confirm dialog, future bookings only): `currency`,
`base_rate_per_30min`.

Intentionally **not** editable: `tax_rate_pct`, `client_mode`,
`age_gate_minimum`, the booking mode (staff_select vs pool), and the
source template.

## Payments (Mollie) and terminals

Settings → Integrations → **Payments (Mollie)**. Enter a Mollie API key
(`test_…` or `live_…`) and toggle Active to collect online deposits. When
Mollie is active, a **Terminal devices** section appears below the key:

- Register physical Mollie PIN terminals by **Name** + **Terminal ID**
  (`term_…`, found in the Mollie dashboard under Point of sale). The stored
  terminal ID is masked on display.
- Remove a terminal with the Remove button (confirm dialog).
- Registered terminals power the **Charge to terminal** button on bookings
  (see booking-guide.md).

## Common owner questions

- *"Clients book and never show; can I vet them first?"* — set Confirm mode
  to "{Staff} must accept", and consider a longer min lead time.
- *"I need 15 minutes between appointments"* — Settings → Bookings → Edit →
  Buffer after = 15.
- *"Same-day bookings keep surprising us"* — raise Min lead time (e.g. 24h).
- *"Why can't I change X?"* — if it shows a Locked tag or has no Edit
  control, it's onboarding-fixed or template-driven; route to support.

## Related APIs (for tool integration)

- `GET /api/{slug}/settings/summary` — tenant + settings + locked_fields +
  integrations (agent-only).
- `PATCH /api/{slug}/settings` — editable fields above; locked fields → 403.
- `GET/PUT /api/{slug}/integrations/whatsapp` — WhatsApp provider config
  (agent-only; GET masks stored values).
- `GET/PUT /api/{slug}/integrations/mollie` — Mollie key + active toggle
  (agent-only; GET masks the key).
- `GET/POST/DELETE /api/{slug}/integrations/mollie/terminals` — PIN terminal
  registration (agent-only; GET masks the terminal ID).
