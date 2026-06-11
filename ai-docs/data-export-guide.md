# Data Export Guide

> CSV exports: where the buttons are, exactly which columns each file
> contains, and the GDPR context.

## The three exports

All are owner-only, one click, and download immediately — no email, no
queue. Files are RFC 4180 CSV (UTF-8, CRLF, quoted where needed), openable
in Excel / Google Sheets.

| Export | Button location | Filename |
|---|---|---|
| Bookings | **Bookings** tab → **Export CSV** (top right) | `bookings-{slug}-{YYYY-MM-DD}.csv` |
| Clients/Guests | **Clients** tab → **Export CSV** | `clients-{slug}-{YYYY-MM-DD}.csv` |
| Staff | **Staff** tab → **Export CSV** | `staff-{slug}-{YYYY-MM-DD}.csv` |

## Bookings export columns

`booking_id, date, start, end, duration_minutes, status, source, staff,
client_name, client_email, services, total_price, requested_at,
confirmed_at, cancelled_at, cancellation_reason, notes`

- `status`: pending_staff / confirmed / cancelled / completed / no_show.
- `source`: `client_request` (widget) or `manual`.
- `services`: semicolon-separated tag names.
- Times are `HH:MM`; rows are sorted newest first.

The dashboard button exports **all** bookings. The underlying API also
accepts filters for tool use: `?status=` (one status or `all`), `?from=` and
`?to=` (date range on the booking date).

## Clients export columns (mode-aware)

- **Guest mode:** `name, email, phone, whatsapp_opt_in, booking_count,
  last_seen_at, created_at`
- **Account mode:** `name, email, phone, status, whatsapp_opt_in,
  created_at`

The export automatically matches the tenant's client mode — there is one
button either way.

## Staff export columns

`name, real_name, status, setup_complete, services, schedule, created_at`

- `services`: semicolon-separated tag names.
- `schedule`: weekly hours like `Mon 09:00-17:00; Tue 09:00-17:00`.

## GDPR / privacy context

- Exports contain **personal data** (names, emails, phones). Advise owners
  to store the files securely and delete them when no longer needed —
  once downloaded, protection is their responsibility.
- The clients export is the practical answer to an **Art. 20 data
  portability** request; the bookings export filtered by that client's
  email covers their booking history.
- Erasure ("right to be forgotten") is **not** self-service — route
  deletion/anonymization requests to platform support.
- The bookings export doubles as the bookkeeping/handover artifact
  (total_price column + the no-show policy from pricing-guide.md).

## Common owner questions

- *"Can I export only last month's bookings?"* — the button exports
  everything; filter by the `date` column in your spreadsheet (or a tool
  can call the API with `from`/`to`).
- *"Can I import data?"* — no import exists. Historical bookings can be
  backfilled one-by-one as manual bookings with status Completed.
- *"Where's the revenue report?"* — there is no separate report; sum
  `total_price` over completed bookings in the bookings export, applying
  the no-show policy for `no_show` rows.

## Related APIs (for tool integration)

- `GET /api/{slug}/export/bookings?status=&from=&to=` (agent).
- `GET /api/{slug}/export/clients` (agent, mode-aware).
- `GET /api/{slug}/export/staff` (agent).
