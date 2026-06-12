# Pricing Guide

> Everything on the Pricing tab: base rate, per-service extras and durations,
> tax, revenue split, deposits, and the no-show revenue policy.

## How a booking's price is calculated

```
price = base_rate_per_30min × (duration_minutes / 30) + Σ extra_price of selected services
```

- **Duration** is the tenant's `default_slot_minutes`, or — when per-service
  duration is enabled — the sum of the selected services' own durations.
- Manual bookings auto-suggest this price but the owner can override it.
- Prices are shown to clients in the widget only when **Show price to
  client** is on (and pricing is enabled).

## The Pricing tab, section by section

Sections appear in this order: **Base Pricing**, **Services & Pricing**,
**Deposits** (only when supported), **Tax**, **Revenue Split**, **No-Show
Policy**. Each editable section has an **Edit** button (then **Save** /
**Cancel**). Fields marked **Locked** were fixed during onboarding and
require platform support to change.

### Base Pricing

- **Pricing enabled** — master toggle for pricing on this tenant.
- **Show price to client** — display the price breakdown in the widget.
- **Currency** — editable.
- **Per-booking price** — shown and edited in the tenant's own appointment
  length (e.g. "€40 per 60-min booking"). Internally the platform always
  stores a per-30-minutes rate; the muted helper line shows that stored
  equivalent. Entering a per-booking price converts it back automatically.
  **0 is a valid price** — it means free bookings or consultations.

### Tax

- **Tax rate** — *locked* (e.g. 21%).
- **Tax label** — editable, e.g. "BTW" for NL.
- **Tax period** — monthly / quarterly / yearly (reporting cadence, no
  behavioral effect yet).

### Revenue Split

**Staff payout %** and **Agency share %** are linked inputs — changing one
sets the other so they always total 100%. A colored bar visualizes the
split. This is informational for revenue reporting; no payouts are
processed by the platform.

### Deposits — only visible when the template supports them

Appears only when the tenant's `deposits_supported` feature flag is true.

- **Deposit % of total** — e.g. 25.
- **Required for bookings over (minutes)** — 0 means "always required when
  deposit % > 0".

The widget shows a **deposit notice** on the confirm step when all three
hold: flag on, deposit % > 0, and booking duration > the minutes threshold.
**No payment is processed** — this is informational scaffolding only; the
owner collects the deposit themselves.

### No-Show Policy

What counts as revenue when a booking is marked no-show:

- **No revenue** (default)
- **Full revenue**
- **Partial revenue** — reveals a **Partial revenue %** field.

### Services & Pricing (second section of the tab)

A table of the tenant's service tags with inline editing:

- **+ Add service** button (top right of the section) — create a new
  service tag any time; it starts with extra price 0 and active.
- **Service name** — editable inline; renaming takes effect on the widget
  immediately after Save.
- **Extra price** — added on top of the base-rate calculation when the
  client selects that service.
- **Per-service duration** checkbox (above the table) — when enabled, a
  **Duration (min)** column appears; each service can set its own
  appointment length (5–600 min, in steps of 5). Blank = the default slot
  length. Selecting multiple services in the widget sums their durations —
  services without a custom duration count as the default appointment
  length in that sum. New tenants can also enable this during onboarding
  ("Services have different durations" in the Booking Configuration step).
- **Active/Inactive** toggle — inactive services disappear from the widget
  but keep their history.
- **Delete** (trash icon, asks for confirmation) — permanently removes a
  service. Services that appear in past bookings cannot be deleted;
  deactivate those instead.
- Per-row **Save** activates once a row has unsaved changes.

## Locked vs editable summary

| Locked after onboarding | Editable anytime |
|---|---|
| Tax rate % | Currency, base rate per 30 min (confirm dialog: future bookings only) |
| Revenue split percentages (slider shows the split but is disabled) | Pricing enabled, show price to client |
| (sometimes) minimum age | Tax period |
| | Deposit % and threshold (if supported) |
| | No-show policy, per-service prices/durations, service add/rename/delete |

## Common owner questions

- *"How do I charge more for service X?"* — Pricing tab → Services &
  Pricing → set its Extra price → Save on that row.
- *"Service X takes 90 minutes, not 30"* — enable **Per-service duration**,
  then set 90 in its Duration column. The widget will offer 90-minute slots
  when that service is selected.
- *"Clients shouldn't see prices"* — Base Pricing → Edit → untick **Show
  price to client**.
- *"I need a different base rate (or currency)"* — Base Pricing → Edit →
  change it → Save → confirm. The change applies to future bookings only;
  historical amounts are never converted or recalculated.
- *"Do you take payments?"* — no. Pricing, deposits and splits are
  informational; collect money outside the platform.

## Related APIs (for tool integration)

- `GET /api/{slug}/settings/summary` — all pricing settings + locked list.
- `PATCH /api/{slug}/settings` — editable pricing fields.
- `GET /api/{slug}/tags`, `POST /api/{slug}/tags` (create),
  `PATCH /api/{slug}/tags/{tagId}` (name, description, extra_price,
  duration_minutes, is_active, display_order),
  `DELETE /api/{slug}/tags/{tagId}` (409 when booking history exists).
