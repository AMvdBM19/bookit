# Client Guide

> How customers ("clients", "guests", or the tenant's own terminology) are
> handled in each client mode, and what the Clients tab can do.

## The two client modes

Each tenant runs in exactly one mode, chosen at tenant creation and **not
editable by the owner** (shown read-only under Settings → Bookings):

| | Guest mode | Account mode |
|---|---|---|
| Booking requires | Name + email (+ optional phone) | A registered, approved account |
| Record created | `guest_clients` row, deduplicated by email | `clients` row at signup |
| Owner moderation | Block by email | Approve / suspend accounts |
| Typical use | Low-friction businesses (tattoo, beauty, repair) | High-trust verticals (adult services) |

## Guest mode

Guests are created **automatically on their first booking** — there is
nothing for the owner to set up. Repeat bookings with the same email reuse
the same guest record and increment its booking count.

The **Clients tab** shows a table: **Name, Email, Phone, {Bookings} count,
Last seen, Actions**, plus an **Export CSV** button.

### Blocking a guest

The **Block** button on a guest row opens a confirmation modal with an
optional **reason** (internal note, not shown to the guest). Blocking:

- prevents *new* bookings from that email via the widget;
- does **not** affect existing bookings — cancel those separately from the
  Bookings tab if needed;
- shows a red **Blocked** badge on the row and dims it.

There is currently no unblock button in the UI — advise contacting platform
support to lift a block.

## Account mode

Clients register themselves through the booking flow. Account statuses:

| Status | Meaning |
|---|---|
| `unverified` | Registered, email not yet verified |
| `pending` | Awaiting owner review |
| `approved` | Can book |
| `rejected` | Denied at review |
| `suspended` | Previously approved, access revoked |

**Only approved clients can book.** New signups create an in-app
notification for the owner ("New client registration: … Review and approve
or reject").

The Clients tab table shows **Name, Email, Phone, Status (badge), Joined,
Actions** with per-row buttons:

- **Approve** (shown unless already approved) — approval can trigger a
  WhatsApp "client approved" message if the client has a phone number, has
  opted in, and a `client_approved` template is configured.
- **Suspend** (shown unless already suspended).

## Phone numbers and WhatsApp opt-in

In both modes a phone number is optional at booking. WhatsApp notifications
(confirmations, reminders, cancellations) are only sent when the
client/guest has a phone number **and** `wa_opt_in` is true. See
notifications-guide.md.

## Privacy notes (GDPR context)

- Client/guest personal data stays within the tenant — staff see only the
  client name on their own bookings.
- The CSV export (data-export-guide.md) supports data-portability requests.
- Deletion/anonymization requests are not self-service yet; route them to
  platform support.

## Common owner questions

- *"A client says they can't book"* — guest mode: check whether their email
  is blocked. Account mode: check their status is `approved`. Also check
  general availability causes (booking-guide.md).
- *"How do I add a client manually?"* — in guest mode, creating a manual
  booking with a new name + email creates the guest record. Account mode
  clients must register themselves.
- *"Can I message all my clients?"* — no bulk messaging exists. Export the
  CSV and use an external tool.

## Related APIs (for tool integration)

- `GET /api/{slug}/guests` — guest list (agent, guest mode).
- `POST /api/{slug}/guests/block` — block by email (agent).
- `GET /api/{slug}/clients` — client list (agent, account mode).
- `PATCH /api/{slug}/clients/{id}/status` — approve/suspend (agent).
- `GET /api/{slug}/export/clients` — CSV export, mode-aware (agent).
- `GET /api/{slug}/bookings/search-clients?q=` — search for manual booking.
