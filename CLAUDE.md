# CLAUDE.md — Book-IT ERP Project

Multi-vertical, multi-tenant B2B appointment booking platform.
Repo: AMvdBM19/bookit
Local: C:\Users\Andres\Desktop\Monoliet\main\bookit
VPS: /opt/docker/bookit (port 3020)

## Tech stack
Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL + Auth), Twilio WhatsApp, node-cron, Docker

## Architecture
One codebase, data-driven industry templates. `industry_templates` (DB) define
terminology + feature/compliance flags + default settings + seed tags; selecting
one stamps a `tenant_config` row for the tenant. Each tenant's `vertical` column
holds the source template slug (free-form), kept for back-compat.
Client modes: account (login required) or guest (email-deduped, no account)
Booking confirm modes: staff_must_accept or auto_confirm
JWT claims: tenant_id, user_role (agent/staff/client/super_admin), staff_id?, client_id?

### Known gotcha: migrations must be applied AND committed
- Database migrations MUST be applied to live Supabase via the Supabase MCP
  `apply_migration` tool AND committed as files in supabase/migrations/ — both,
  always, in the same work block. Committing the .sql file alone does NOT
  change the live schema. (Phase 13 audit finding: code shipped reading
  columns that didn't exist; optional chaining masked it.)

### Known gotcha: Next.js data caching + Supabase service client
`createServiceClient()` (lib/supabase/server.ts) forces `cache: 'no-store'` on every underlying
fetch since Phase 14-A3 — do not remove that option. Before that, Next's Data Cache persisted
Supabase REST responses in `.next/cache` even on `force-dynamic` segments, so reads served stale
data until the container was rebuilt (stale-data bugs three times: catalog in Phase 10C, widget
theme in Phase 12A, customizer saves in Phase 14). Keep `export const dynamic = 'force-dynamic'`
on layouts/pages that query Supabase anyway, so the route itself isn't statically cached.

## Key paths
lib/types/tenant-config.ts — JSONB contract interfaces (Terminology, FeatureFlags, ComplianceFlags, DefaultSettings) + DEFAULT_* constants + core type aliases (VerticalId, ClientMode, BookingConfirmMode)
lib/context/tenant-config.tsx — TenantConfigProvider + useTenantConfig() (data-driven config)
lib/templates/validation.ts — JSONB payload validators for templates/tenant_config
lib/context/           — React context providers (TenantProvider, TenantConfigProvider)
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
app/api/[slug]/settings/ — settings summary (GET) + PATCH (editable non-locked fields)
lib/rate-limit/          — IP-based rate limiting for public endpoints (booking POST)
app/api/[slug]/notifications/ — WA/email template CRUD (agent-only)
app/super-admin/         — super admin console (Tenants + Templates tabs, API-key auth)
app/api/super-admin/     — super admin tenant CRUD + stats + template CRUD + tenant config/reset
app/api/templates/active — public active templates for the wizard picker
app/api/[slug]/setup/select-template — stamps tenant_config from a chosen template
instrumentation.ts         — boots reminder cron in Node runtime
lib/cron/                  — node-cron jobs (reminders, retention)
lib/auth/super-admin.ts  — Bearer + httpOnly cookie validation for super-admin routes
app/api/health/            — shallow health check (DB probe, used by Docker HEALTHCHECK)
lib/gdpr/anonymize.ts      — shared GDPR client anonymization (used by erasure API + retention cron)
app/api/[slug]/clients/[clientId]/anonymize/ — agent-only client erasure (GDPR Art. 17)
app/api/[slug]/clients/[clientId]/export/   — agent-only client data export (JSON)
app/api/super-admin/auth/  — super-admin login/logout (httpOnly cookie)
scripts/check-migration-drift.sh — compares local migrations vs Supabase applied
app/book/[slug]/         — public booking widget + APIs (no auth)
app/book/[slug]/api/     — catalog, availability, book endpoints
lib/widget-theme.ts      — widget theming (WidgetTheme, PRESETS, themeToVars/CSS, settings mapping); widget renders from --w-* CSS vars set in app/book/[slug]/layout.tsx, live-preview via postMessage 'bookit:theme-override'
app/api/[slug]/staff/    — staff creation API (agent-only)
lib/whatsapp/            — WA provider abstraction (Twilio + Meta)
supabase/migrations/   — DB schema
supabase/seed.sql      — demo data (inkhaus + velours-demo)

## Tenant config shape (lib/types/tenant-config.ts)
`tenant_config` holds three JSONB blocks + source_template_slug:
- Terminology: staff, staff_plural, client, client_plural, booking, booking_plural, operator, service_tag
- FeatureFlags: show_age_gate_step, age_gate_minimum, staff_require_pseudonym, deposits_supported, show_price_to_client, require_booking_notes, booking_notes_label, booking_notes_placeholder
- ComplianceFlags: show_kvk_field, show_license_field, show_bsn_on_staff, show_gdpr_photo_consent, require_terms_acceptance
DefaultSettings (template only, applied to tenant_settings at creation): client_mode, booking_confirm_mode, client_approval_mode, default_slot_minutes, deposit_pct, deposit_required_above_minutes.
Read at runtime via useTenantConfig() (client) or a `tenant_config` query (server/public).

## Auth flow
Middleware (middleware.ts) resolves tenant from slug via raw Supabase REST (edge-compatible)
app/[slug]/layout.tsx resolves full TenantContext, fetches tenant_config, injects TenantConfigProvider
lib/auth/session.ts reads JWT claims for AuthenticatedUser
Staff with first_login=true → forced to /change-password after login

## Wizard (setup)
Dynamic step array driven by tenant_config. Step 0 = template picker (only when
source_template_slug is null); after selection, router.refresh() re-stamps config
and the picker drops out. Compliance step only appears when any compliance flag or
the age gate is active. Compliance flags are read-only notices; only the age gate
is tenant-editable.

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
Phase 8: ✅ Super admin console, WordPress hardening, accumulated cleanup
Phase 9: ✅ Widget polish, deposit scaffold, rate limiting, settings edit
Phase 10A-1: ✅ industry_templates + tenant_config tables, APIs, TenantConfigProvider
Phase 10A-2: ✅ Codebase swap to data-driven templates, wizard redesign, old vertical system removed
Phase 10C: ✅ Catalog caching fix, deposits feature flag, logout, calendar buttons, widget pricing, staff dashboard editing
Phase 10C-2: ✅ Staff login fix (hard nav), time format fix (HH:MM), base_price_label terminology, root slug redirect
Phase 11A: ✅ Booking status lifecycle (source column, completion/no-show API, booking_completion_by flag, UI buttons)
Phase 11B: ✅ Manual booking creation (create API, client search API, modal UI, off-grid manual bookings)
Phase 11C: ✅ Pool booking mode (booking_mode flag, wizard step, pool availability, widget flow, staff claim, admin assign)
Phase 12A: ✅ Widget customizer (CSS variable theming, live preview, 8 presets, embed code export, new Widget dashboard tab)
Tier 1 Polish Sprint: ✅ Groups 1-10 (shared UI components, toasts, loading/empty states, confirm dialogs, onboarding checklist, per-service duration, buffer time, staff days off UI, CSV export, AI assistant foundation)
Phase 21: ✅ Production Hardening (Sentry error tracking, /api/health endpoint, Docker HEALTHCHECK, super-admin httpOnly cookie auth, RLS audit, webhook hardening, GDPR client anonymization + data export + retention cron, terms/privacy consent on widget, seed.sql safety guard, migration drift script, VPS backup infrastructure)

## Deposits
Widget shows a deposit notice when deposits_supported flag is true AND deposit_pct>0 AND duration>deposit_required_above_minutes.
No payment processing yet — informational scaffolding only.

## AI assistant (foundation only)
ai-docs/ — markdown knowledge base grounding the future tenant assistant (one guide per feature area + changelog.md + tools-reference.md)
lib/ai/ — provider-agnostic skeleton: adapter.ts (AIAdapter contract), providers/ (getAdapter factory, all throw not-implemented), tools/ (empty registry), docs/loader.ts (loadDocsForTab + PAGE_DOC_MAP), context/builder.ts (buildSystemPrompt)
app/api/[slug]/assistant — POST, agent-only; 403 when tenant_settings.ai_assistant_enabled=false, 501 otherwise (no provider yet)
tenant_settings.ai_assistant_enabled (default false) + ai_provider ('anthropic'|'openai'|'mistral'|null) already exist in the schema — do not re-add.

## AI Docs Maintenance Protocol
The ai-docs/ folder is the assistant's only knowledge of the product. It MUST stay in sync with shipped behavior:
1. Any PR/commit that changes user-facing behavior (UI labels, flows, settings, statuses, APIs the docs mention) must update the affected ai-docs/*.md guide(s) in the same commit.
2. Every shipped feature gets an entry at the TOP of ai-docs/changelog.md (date + short description, newest first).
3. New dashboard tabs or pages must be added to PAGE_DOC_MAP in lib/ai/docs/loader.ts and get (or reuse) a guide.
4. Guides are written for an LLM advising a business owner: UI-oriented, exact tab/button names, tenant terminology placeholders like {staff}, and a "Related APIs" section for future tool use.
5. New assistant tools must be documented in ai-docs/tools-reference.md (move from "planned" to active) when registered in lib/ai/tools/index.ts.
6. Docs state facts about current behavior only — no roadmap promises except inside tools-reference.md's clearly marked planned section.
