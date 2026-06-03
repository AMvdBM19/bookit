# CLAUDE.md — Book-IT ERP Project

Multi-vertical, multi-tenant B2B appointment booking platform.
Repo: AMvdBM19/bookit
Local: C:\Users\Andres\Desktop\Monoliet\main\bookit
VPS: /opt/docker/bookit (port 3020)

## Tech stack
Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL + Auth), Twilio WhatsApp, node-cron, Docker

## Architecture
One codebase, config-driven verticals. Each tenant has a vertical field that loads a VerticalConfig at runtime.
Client modes: account (login required) or guest (email-deduped, no account)
Booking confirm modes: staff_must_accept or auto_confirm
JWT claims: tenant_id, user_role (agent/staff/client/super_admin), staff_id?, client_id?

## Key paths
lib/verticals/         — vertical config system (types, registry, adult-services, tattoo)
lib/context/           — React context providers (TenantProvider, VerticalProvider)
lib/auth/              — session helpers, tenant resolution
lib/supabase/          — server/client/middleware Supabase clients
app/[slug]/            — all tenant-scoped routes
app/[slug]/(auth)/     — login, logout, change-password (outside tenant layout)
app/[slug]/setup/      — onboarding wizard (agent-only)
app/[slug]/staff-setup/  — staff profile wizard (4-step)
app/[slug]/dashboard/    — role-based dashboard (agent: ERP tabs; staff: pending bookings)
app/api/[slug]/bookings/ — booking accept/decline + list APIs
app/api/[slug]/clients/  — client status PATCH (account mode)
app/api/[slug]/guests/   — guest list + block APIs (guest mode)
app/api/[slug]/settings/ — settings summary (agent-only, read-only)
app/api/[slug]/notifications/ — WA/email template CRUD (agent-only)
instrumentation.ts         — boots reminder cron in Node runtime
lib/cron/                  — node-cron jobs (reminders)
app/book/[slug]/         — public booking widget + APIs (no auth)
app/book/[slug]/api/     — catalog, availability, book endpoints
app/api/[slug]/staff/    — staff creation API (agent-only)
lib/whatsapp/            — WA provider abstraction (Twilio + Meta)
supabase/migrations/   — DB schema
supabase/seed.sql      — demo data (inkhaus + velours-demo)

## Vertical config shape (lib/verticals/types.ts)
VerticalConfig has: id, label, terminology, defaults, boolean wizard flags (show_kvk_field etc.), seed_tags, deposits_supported.
NO nested wizard object. Flags live directly on VerticalConfig.

## Auth flow
Middleware (middleware.ts) resolves tenant from slug via raw Supabase REST (edge-compatible)
app/[slug]/layout.tsx resolves full TenantContext + injects VerticalProvider
lib/auth/session.ts reads JWT claims for AuthenticatedUser
Staff with first_login=true → forced to /change-password after login

## Demo tenants
inkhaus (tattoo, guest mode) — agent: agent@inkhaus.nl / Test1234!
velours-demo (adult_services, account mode) — agent: agent@velours-demo.nl / Test1234!

## Phase tracker
Phase 1: ✅ Repo + vertical config + DB
Phase 2: ✅ Auth + tenant resolution + route shell
Phase 3: ✅ Wizard (complete)
Phase 4: ✅ Staff flow + WA dispatch + calendar link
Phase 5: ✅ Client widget (guest + account mode) + booking engine
Phase 6: ✅ Agent ERP dashboard (bookings, staff, guests/clients, settings)
Phase 7: ✅ Reminder cron wiring, WA templates API + UI, cancellation dispatch
Phase 8-9: pending
