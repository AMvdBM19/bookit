# Tools Reference

> What the AI assistant can and cannot do, and the planned tool catalog.
> **Status: NO TOOLS ARE ACTIVE YET.** The assistant is read-the-docs
> advisory only.

## Current capabilities (Phase: foundation)

The assistant can:

- Answer questions about how Book-IT works, grounded in these ai-docs.
- Explain every dashboard tab, setting, flow, and limitation.
- Advise on business configuration (buffers, lead times, pricing setup,
  notification templates) and tell the owner *exactly where to click*.
- Use the tenant's own terminology, feature flags, and current settings
  when they are provided in its context.

The assistant can **not** (yet):

- Read live tenant data (bookings, clients, revenue) beyond what is given
  in its context.
- Change any setting, create/accept/decline bookings, message clients, or
  trigger exports.
- Access other tenants, super-admin functions, or platform infrastructure.

When a user asks for an action, the assistant should explain the manual
steps in the dashboard instead, and may mention that direct actions are
planned.

## Planned tool catalog (NOT YET ACTIVE)

Designed to map 1:1 onto existing agent-scoped APIs, executing with the
agent's own authorization — never more. Read tools land first; write tools
will require explicit per-action user confirmation in the chat UI.

### Read tools (planned wave 1)

| Tool | Backing API | Purpose |
|---|---|---|
| `get_settings` | GET /api/{slug}/settings/summary | Current settings + locked fields |
| `list_bookings` | GET /api/{slug}/bookings | Filterable booking list |
| `list_staff` | GET /api/{slug}/staff | Roster with schedule/tags |
| `list_clients` | GET /api/{slug}/clients · /guests | Client/guest list |
| `list_services` | GET /api/{slug}/tags | Services with price/duration |
| `get_booking_stats` | (derived) | Counts/revenue summaries for advice |

### Write tools (planned wave 2, confirmation-gated)

| Tool | Backing API | Purpose |
|---|---|---|
| `update_setting` | PATCH /api/{slug}/settings | Editable, non-locked fields only |
| `update_service` | PATCH /api/{slug}/tags/{id} | Price, duration, active |
| `accept_booking` / `decline_booking` | POST …/accept · /decline | Pending requests |
| `create_booking` | POST /api/{slug}/bookings/create | Manual bookings |
| `edit_booking` | PATCH /api/{slug}/bookings/{id}/edit | Edit services/notes/price on pending, confirmed, or recently completed bookings (audit-trailed) |
| `add_staff_day_off` | POST …/staff/{id}/exceptions | Days off |
| `update_notification_template` | POST …/notifications/templates | Template upsert |
| `configure_email_integration` | PUT /api/{slug}/integrations/email | Enable/adjust the email channel |
| `send_test_email` | (planned endpoint) | Send a test template email to the owner's address |
| `export_csv` | GET /api/{slug}/export/* | Generate a download link |

### Explicitly out of scope (never planned)

- Anything super-admin: creating tenants, editing industry templates,
  unlocking locked fields.
- Free-form messaging to clients (templates fire on events only).
- Payment processing (none exists in the platform).
- Cross-tenant queries of any kind.

## Architecture notes (for maintainers)

- Endpoint: `POST /api/{slug}/assistant` — agent-only; 403 when
  `ai_assistant_enabled` is false; currently returns **501** because no
  provider adapter is implemented.
- Skeleton in `lib/ai/`: provider-agnostic `AIAdapter` interface
  (anthropic / openai / mistral per `tenant_settings.ai_provider`), a tool
  registry (`lib/ai/tools/`), doc loading per dashboard tab
  (`lib/ai/docs/loader.ts`), and system-prompt assembly
  (`lib/ai/context/builder.ts`).
- Grounding docs: this `ai-docs/` folder, maintained via the AI Docs
  Maintenance Protocol in CLAUDE.md.
