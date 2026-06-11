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

Each section has an **Edit** button (then **Save** / **Cancel**). Fields
marked **Locked** were fixed during onboarding and require platform support
to change.

### Base Pricing

- **Pricing enabled** — master toggle for pricing on this tenant.
- **Show price to client** — display the price breakdown in the widget.
- **Currency** — *locked*.
- **Base rate** — *locked*; the per-30-minutes rate everything builds on.

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

### Per-Service Pricing (bottom of the tab)

A table of the tenant's service tags with inline editing:

- **Extra price** — added on top of the base-rate calculation when the
  client selects that service.
- **Per-service duration** checkbox (above the table) — when enabled, a
  **Duration (min)** column appears; each service can set its own
  appointment length (5–600 min, in steps of 5). Blank = the default slot
  length. Selecting multiple services in the widget sums their durations.
- **Active/Inactive** toggle — inactive services disappear from the widget
  but keep their history. Services themselves are created during the setup
  wizard.
- Per-row **Save** activates once a row has unsaved changes.

## Locked vs editable summary

| Locked after onboarding | Editable anytime |
|---|---|
| Currency | Pricing enabled, show price to client |
| Base rate per 30 min | Tax label, tax period |
| Tax rate % | Revenue split percentages |
| (sometimes) minimum age | Deposit % and threshold (if supported) |
| | No-show policy, per-service prices/durations |

## Common owner questions

- *"How do I charge more for service X?"* — Pricing tab → Per-Service
  Pricing → set its Extra price → Save on that row.
- *"Service X takes 90 minutes, not 30"* — enable **Per-service duration**,
  then set 90 in its Duration column. The widget will offer 90-minute slots
  when that service is selected.
- *"Clients shouldn't see prices"* — Base Pricing → Edit → untick **Show
  price to client**.
- *"I need a different base rate"* — locked; route to platform support.
- *"Do you take payments?"* — no. Pricing, deposits and splits are
  informational; collect money outside the platform.

## Related APIs (for tool integration)

- `GET /api/{slug}/settings/summary` — all pricing settings + locked list.
- `PATCH /api/{slug}/settings` — editable pricing fields.
- `GET /api/{slug}/tags`, `PATCH /api/{slug}/tags/{tagId}` — per-service
  extra_price, duration_minutes, is_active.
