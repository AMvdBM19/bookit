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

## Integrations section

- **WhatsApp** — shows a status badge ("Not configured" / "Active
  (Twilio)" / "Active (Meta)") and a **Configure** button opening a modal:
  pick the provider, then enter the **WhatsApp sender number**
  (international format, Twilio) or the **Phone number ID** + optional
  WhatsApp Business Account ID (Meta), and an Active toggle. Platform API
  credentials (Twilio account, Meta access token) are managed by Book-IT;
  the owner never enters tokens. Without an active integration, no
  WhatsApp messages are sent (templates can still be edited and saved).
- **AI assistant** and **Email notifications** show as "Coming soon".

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
