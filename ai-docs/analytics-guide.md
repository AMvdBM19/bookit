# Analytics Guide

> The Analytics tab: KPIs and charts derived from the tenant's bookings.

## What it is

A read-only dashboard tab (after {bookings} in the sidebar) showing
performance metrics for a chosen period. All numbers come from the
tenant's own bookings — nothing is estimated or projected.

## Period selector

Segmented control at the top: **7 days / 30 days / 90 days** (default 30).
Every metric and chart recomputes for the selected window. The window is
the last N days up to today, by booking date (`slot_date`).

## KPI cards

- **Total {bookings}** — count of bookings whose date falls in the period.
- **Revenue** — sum of `total_price` for **completed** bookings only
  (money actually earned), formatted in the tenant currency.
- **Completion** — completed ÷ (completed + no-show + cancelled), i.e. of
  bookings whose outcome is decided, the share that were fulfilled.
- **No-show** — no-show ÷ (completed + no-show + cancelled). Highlighted
  amber when above 10%.
- **Avg / {staff}** — total bookings ÷ active staff count.

## Charts (2×2)

- **{bookings} by day** — bar chart, one bar per day in the period
  (zero-filled), so gaps are visible.
- **Revenue by week** — line chart of completed-booking revenue grouped by
  ISO week.
- **Source** — pie of widget vs manual bookings.
- **Status** — donut of the booking status mix (completed / confirmed /
  pending / cancelled / no-show), using the standard status colors.

Charts have hover tooltips and stack to a single column on narrow screens.
Tenants with no bookings in the period see an empty state, not broken
charts. "Projections coming soon" sits at the bottom — there is no
forecasting yet; do not promise it.

## Common owner questions

- *"Why is revenue lower than my bookings suggest?"* — revenue counts
  **completed** bookings only; pending/confirmed/cancelled don't add to it
  until completed.
- *"My completion rate ignores upcoming bookings"* — correct: only decided
  outcomes (completed/no-show/cancelled) feed the rate, so future
  confirmed bookings don't drag it down.
- *"Can I export this?"* — not yet; the Bookings tab has CSV export of the
  underlying bookings.

## Related APIs (for tool integration)

- `GET /api/{slug}/analytics?period=7d|30d|90d` — KPIs + chart series
  (agent). Aggregates server-side from bookings; no new tables.
