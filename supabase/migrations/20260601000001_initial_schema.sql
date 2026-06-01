-- Book-IT ERP — Initial Schema Migration
-- Multi-vertical, multi-tenant appointment management platform
-- Derived from Velours ERP with all known bugs fixed + Book-IT additions

-- ============================================================================
-- 1. TENANTS
-- ============================================================================
CREATE TABLE tenants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  slug                  TEXT UNIQUE NOT NULL,
  -- Book-IT: vertical determines terminology, wizard steps, and defaults
  vertical              TEXT NOT NULL DEFAULT 'adult_services'
    CHECK (vertical IN ('adult_services', 'tattoo')),
  -- Book-IT: client_mode controls guest vs account flow
  client_mode           TEXT NOT NULL DEFAULT 'account'
    CHECK (client_mode IN ('account', 'guest')),
  kvk_number            TEXT,
  license_number        TEXT,
  registered_domain     TEXT,
  domain_verified       BOOLEAN DEFAULT FALSE,
  domain_txt_token      TEXT,
  subscription_tier     TEXT DEFAULT 'basic',
  is_active             BOOLEAN DEFAULT TRUE,
  wizard_completed      BOOLEAN DEFAULT FALSE,
  wizard_step           INT DEFAULT 1,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tenants
  USING (id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

-- ============================================================================
-- 2. AGENTS
-- ============================================================================
CREATE TABLE agents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  phone         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON agents
  USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

-- ============================================================================
-- 3. STAFF (workers/artists — terminology is vertical-driven)
-- ============================================================================
CREATE TABLE staff (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  real_name               TEXT,
  bsn                     TEXT,
  kvk_number              TEXT,
  -- Display name (pseudonym for adult, real/stage name for tattoo)
  pseudonym               TEXT NOT NULL,
  age                     INT CHECK (age >= 18),
  nationality             TEXT,
  gender                  TEXT,
  languages               TEXT[],
  bio                     TEXT,
  photo_urls              TEXT[],
  -- Book-IT: social links as JSONB — keys: instagram, tiktok, facebook, x, website
  social_links            JSONB DEFAULT '{}'::jsonb,
  status                  TEXT DEFAULT 'inactive'
    CHECK (status IN ('active', 'inactive', 'offline')),
  offline_reason          TEXT,
  consent_photo_signed_at TIMESTAMPTZ,
  tos_signed_at           TIMESTAMPTZ,
  btw_exempt              BOOLEAN DEFAULT FALSE,
  wizard_completed        BOOLEAN DEFAULT FALSE,
  first_login             BOOLEAN DEFAULT TRUE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  created_by_agent_id     UUID REFERENCES agents(id)
);

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON staff
  USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

-- ============================================================================
-- 4. CLIENTS (account mode — login required)
-- ============================================================================
CREATE TABLE clients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  real_name           TEXT,
  email               TEXT NOT NULL,
  phone               TEXT,
  display_name        TEXT NOT NULL,
  status              TEXT DEFAULT 'unverified'
    CHECK (status IN ('unverified', 'pending', 'approved', 'rejected', 'suspended')),
  status_reason       TEXT,
  status_changed_at   TIMESTAMPTZ,
  -- BUG 3 FIX: changed_by is TEXT (not UUID FK to agents)
  -- 'system' string inserts are valid; use changed_by_agent_id for FK reference
  status_changed_by   TEXT,
  changed_by_agent_id UUID REFERENCES agents(id),
  wa_opt_in           BOOLEAN DEFAULT FALSE,
  wa_opt_in_at        TIMESTAMPTZ,
  approved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON clients
  USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

-- ============================================================================
-- 5. GUEST_CLIENTS (guest mode — no login, email-deduped per tenant)
-- ============================================================================
CREATE TABLE guest_clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  email       TEXT NOT NULL,
  name        TEXT NOT NULL,
  phone       TEXT,
  wa_opt_in   BOOLEAN DEFAULT FALSE,
  -- Repeat recognition: track how many bookings this guest has made
  booking_count INT DEFAULT 0,
  last_seen_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  -- One guest record per email per tenant
  UNIQUE (tenant_id, email)
);

ALTER TABLE guest_clients ENABLE ROW LEVEL SECURITY;

-- Guests are not authenticated — service role only for reads/writes
CREATE POLICY guest_clients_service_only ON guest_clients
  USING (FALSE);

-- ============================================================================
-- 6. GUEST_BLOCKS (block specific emails/phones from guest booking)
-- ============================================================================
CREATE TABLE guest_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  email       TEXT,
  phone       TEXT,
  reason      TEXT,
  blocked_by_agent_id UUID REFERENCES agents(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

ALTER TABLE guest_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON guest_blocks
  USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

-- ============================================================================
-- 7. SERVICE_TAGS
-- ============================================================================
CREATE TABLE service_tags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  extra_price     NUMERIC(10,2),
  is_active       BOOLEAN DEFAULT TRUE,
  display_order   INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE service_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON service_tags
  USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

-- ============================================================================
-- 8. STAFF_SCHEDULE
-- ============================================================================
CREATE TABLE staff_schedule (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  staff_id      UUID REFERENCES staff(id) ON DELETE CASCADE NOT NULL,
  day_of_week   INT CHECK (day_of_week BETWEEN 0 AND 6),
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  CHECK (end_time > start_time)
);

ALTER TABLE staff_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON staff_schedule
  USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

-- ============================================================================
-- 9. STAFF_EXCEPTIONS
-- ============================================================================
CREATE TABLE staff_exceptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  staff_id        UUID REFERENCES staff(id) ON DELETE CASCADE NOT NULL,
  exception_date  DATE NOT NULL,
  reason          TEXT,
  created_by      TEXT CHECK (created_by IN ('staff', 'agent')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE staff_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON staff_exceptions
  USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

-- ============================================================================
-- 10. BOOKINGS
-- ============================================================================
CREATE TABLE bookings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  staff_id                UUID REFERENCES staff(id),
  -- Either client_id (account mode) or guest_client_id (guest mode) — not both
  client_id               UUID REFERENCES clients(id),
  guest_client_id         UUID REFERENCES guest_clients(id),
  booking_source          TEXT DEFAULT 'client_request'
    CHECK (booking_source IN ('client_request', 'manual')),
  slot_date               DATE NOT NULL,
  slot_start              TIME NOT NULL,
  slot_end                TIME NOT NULL,
  duration_minutes        INT NOT NULL,
  location_type           TEXT CHECK (location_type IN ('incall', 'outcall', 'other')),
  location_address        TEXT,
  location_lat            NUMERIC,
  location_lng            NUMERIC,
  location_notes          TEXT,
  -- Book-IT: booking notes — label and required state are vertical-driven
  booking_notes           TEXT,
  base_rate_per_30        NUMERIC(10,2),
  tag_extras_total        NUMERIC(10,2) DEFAULT 0,
  total_price             NUMERIC(10,2),
  staff_payout            NUMERIC(10,2),
  agency_share            NUMERIC(10,2),
  -- Book-IT: deposit schema (reserved for Phase 2 payment UI)
  deposit_required        BOOLEAN DEFAULT FALSE,
  deposit_amount          NUMERIC(10,2),
  deposit_paid            BOOLEAN DEFAULT FALSE,
  -- BUG-FIX: status uses 'pending_staff' not 'pending_worker' (matches API naming)
  -- booking_confirm_mode = 'auto_confirm' skips pending_staff entirely
  status                  TEXT DEFAULT 'pending_staff'
    CHECK (status IN ('pending_staff', 'confirmed', 'completed', 'cancelled', 'no_show')),
  no_show_revenue_policy  TEXT,
  requested_at            TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at            TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  cancelled_at            TIMESTAMPTZ,
  cancelled_by            TEXT CHECK (cancelled_by IN ('staff', 'agent', 'client', 'system')),
  cancellation_reason     TEXT,
  -- Reminder sent flag for cron job
  reminder_sent           BOOLEAN DEFAULT FALSE,
  reminder_sent_at        TIMESTAMPTZ,
  CHECK (
    (client_id IS NOT NULL AND guest_client_id IS NULL) OR
    (client_id IS NULL AND guest_client_id IS NOT NULL) OR
    -- manual bookings may have neither
    (client_id IS NULL AND guest_client_id IS NULL AND booking_source = 'manual')
  )
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON bookings
  USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

-- ============================================================================
-- 11. BOOKING_SERVICE_TAGS
-- ============================================================================
CREATE TABLE booking_service_tags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  booking_id    UUID REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
  tag_id        UUID REFERENCES service_tags(id),
  tag_name      TEXT NOT NULL,
  extra_price   NUMERIC(10,2) DEFAULT 0
);

ALTER TABLE booking_service_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON booking_service_tags
  USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

-- ============================================================================
-- 12. STAFF_SERVICE_TAGS
-- ============================================================================
CREATE TABLE staff_service_tags (
  staff_id    UUID REFERENCES staff(id) ON DELETE CASCADE,
  tag_id      UUID REFERENCES service_tags(id) ON DELETE CASCADE,
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (staff_id, tag_id)
);

ALTER TABLE staff_service_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON staff_service_tags
  USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

-- ============================================================================
-- 13. CLIENT_RATINGS (account mode clients only)
-- ============================================================================
CREATE TABLE client_ratings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  booking_id    UUID REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
  staff_id      UUID REFERENCES staff(id),
  client_id     UUID REFERENCES clients(id),
  score         INT CHECK (score BETWEEN 1 AND 5),
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE client_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON client_ratings
  USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

-- ============================================================================
-- 14. BLACKLIST_FLAGS
-- ============================================================================
CREATE TABLE blacklist_flags (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  client_id             UUID REFERENCES clients(id),
  guest_client_id       UUID REFERENCES guest_clients(id),
  flagged_by_staff_id   UUID REFERENCES staff(id),
  booking_id            UUID REFERENCES bookings(id),
  reason                TEXT NOT NULL,
  status                TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'dismissed')),
  reviewed_by_agent_id  UUID REFERENCES agents(id),
  reviewed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE blacklist_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON blacklist_flags
  USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

-- ============================================================================
-- 15. CLIENT_STATUS_LOG
-- BUG 3 FIX: changed_by is TEXT (not UUID FK to agents)
-- Code can insert 'system', 'wizard', or an agent UUID string.
-- Separate changed_by_agent_id UUID FK for relational integrity when available.
-- ============================================================================
CREATE TABLE client_status_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  client_id             UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  from_status           TEXT,
  to_status             TEXT NOT NULL,
  reason                TEXT NOT NULL,
  changed_by            TEXT,
  changed_by_agent_id   UUID REFERENCES agents(id),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE client_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON client_status_log
  USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

-- ============================================================================
-- 16. NOTIFICATION_LOG
-- ============================================================================
CREATE TABLE notification_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  booking_id      UUID REFERENCES bookings(id),
  event_type      TEXT NOT NULL,
  recipient_type  TEXT CHECK (recipient_type IN ('client', 'guest_client', 'staff', 'agent')),
  recipient_phone TEXT,
  recipient_email TEXT,
  channel         TEXT CHECK (channel IN ('whatsapp', 'email', 'in_platform')),
  status          TEXT CHECK (status IN ('sent', 'failed', 'pending')),
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON notification_log
  USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

-- ============================================================================
-- 17. AGENT_NOTIFICATIONS
-- BUG 1 & 2 FIX: table name is agent_notifications (not notifications)
-- Column names match the API and dispatch.ts exactly.
-- ============================================================================
CREATE TABLE agent_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  type            TEXT NOT NULL,
  priority        INT DEFAULT 3,
  linked_entity   TEXT,
  linked_id       UUID,
  message         TEXT,
  is_read         BOOLEAN DEFAULT FALSE,
  is_resolved     BOOLEAN DEFAULT FALSE,
  resolved_by     UUID REFERENCES agents(id),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON agent_notifications
  USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

-- ============================================================================
-- 18. TENANT_SETTINGS
-- ============================================================================
CREATE TABLE tenant_settings (
  tenant_id                     UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  -- Booking rules
  default_slot_minutes          INT DEFAULT 30,
  min_lead_time_hours           INT DEFAULT 2,
  max_booking_days_ahead        INT DEFAULT 30,
  allow_back_to_back            BOOLEAN DEFAULT FALSE,
  cancellation_window_hours     INT DEFAULT 24,
  -- Book-IT: booking confirmation mode — set in wizard Step 3, editable in Settings > Booking Rules
  booking_confirm_mode          TEXT DEFAULT 'staff_must_accept'
    CHECK (booking_confirm_mode IN ('staff_must_accept', 'auto_confirm')),
  -- Pricing
  pricing_enabled               BOOLEAN DEFAULT TRUE,
  base_rate_per_30min           NUMERIC(10,2) DEFAULT 60.00,
  staff_payout_pct              NUMERIC(5,2) DEFAULT 70.00,
  agency_share_pct              NUMERIC(5,2) DEFAULT 30.00,
  currency                      TEXT DEFAULT 'EUR',
  show_price_to_client          BOOLEAN DEFAULT TRUE,
  no_show_revenue_policy        TEXT DEFAULT 'zero'
    CHECK (no_show_revenue_policy IN ('full', 'partial', 'zero')),
  no_show_partial_pct           NUMERIC(5,2) DEFAULT 50.00,
  -- Tax
  tax_rate_pct                  NUMERIC(5,2) DEFAULT 21.00,
  tax_label                     TEXT DEFAULT 'BTW',
  tax_period                    TEXT DEFAULT 'quarterly',
  -- Client approval (account mode only)
  client_approval_mode          TEXT DEFAULT 'manual'
    CHECK (client_approval_mode IN ('auto', 'manual')),
  age_gate_minimum              INT DEFAULT 18,
  require_age_confirm           BOOLEAN DEFAULT TRUE,
  require_id_upload             BOOLEAN DEFAULT FALSE,
  require_phone_verify          BOOLEAN DEFAULT FALSE,
  -- Staff offline behaviour
  offline_behaviour             TEXT DEFAULT 'auto_approve'
    CHECK (offline_behaviour IN ('auto_approve', 'require_acknowledgement', 'blocked')),
  -- Notifications / reminders
  reminder_lead_time_minutes    INT DEFAULT 60,
  wa_sender_name                TEXT,
  email_sender_name             TEXT,
  -- KPI visibility
  staff_kpi_visible             BOOLEAN DEFAULT TRUE,
  -- Notification log retention
  notification_log_months       INT DEFAULT 12,
  -- ERP Branding
  brand_color                   TEXT DEFAULT '#2BB673',
  logo_url                      TEXT,
  agency_display_name           TEXT,
  erp_theme                     TEXT DEFAULT 'dark'
    CHECK (erp_theme IN ('light', 'dark')),
  -- Widget branding
  widget_layout                 TEXT DEFAULT 'grid'
    CHECK (widget_layout IN ('grid', 'list', 'minimal')),
  widget_primary_color          TEXT DEFAULT '#2BB673',
  widget_accent_color           TEXT DEFAULT '#1D9E75',
  widget_bg                     TEXT DEFAULT 'white'
    CHECK (widget_bg IN ('white', 'off-white', 'light-gray', 'dark')),
  widget_logo_url               TEXT,
  widget_font_pair              TEXT DEFAULT 'default',
  -- Staff limit
  max_staff                     INT DEFAULT 15,
  -- Integrations
  integrations_enabled          BOOLEAN DEFAULT FALSE,
  -- AI assistant
  ai_assistant_enabled          BOOLEAN DEFAULT FALSE,
  ai_provider                   TEXT DEFAULT NULL
    CHECK (ai_provider IN ('anthropic', 'openai', 'mistral', NULL)),
  -- Compliance
  gdpr_retention_years          INT DEFAULT 7,
  updated_at                    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tenant_settings
  USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

-- ============================================================================
-- 19. NOTIFICATION_TEMPLATES
-- ============================================================================
CREATE TABLE notification_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  event_type    TEXT NOT NULL,
  channel       TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  subject       TEXT,
  body          TEXT NOT NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, event_type, channel)
);

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON notification_templates
  USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

-- ============================================================================
-- 20. TENANT_INTEGRATIONS
-- ============================================================================
CREATE TABLE tenant_integrations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  integration_type      TEXT NOT NULL,
  api_key               TEXT,
  is_active             BOOLEAN DEFAULT TRUE,
  added_by_agent_id     UUID REFERENCES agents(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, integration_type)
);

ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tenant_integrations
  USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

-- ============================================================================
-- 21. TENANT_LOCKED_SETTINGS
-- ============================================================================
CREATE TABLE tenant_locked_settings (
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  field_name  TEXT NOT NULL,
  locked_at   TIMESTAMPTZ DEFAULT NOW(),
  locked_by   TEXT DEFAULT 'wizard',
  PRIMARY KEY (tenant_id, field_name)
);

ALTER TABLE tenant_locked_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tenant_locked_settings
  USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

-- ============================================================================
-- FINANCE SUMMARY VIEW
-- ============================================================================
CREATE VIEW finance_summary AS
SELECT
  b.tenant_id,
  b.staff_id,
  s.pseudonym,
  s.btw_exempt,
  DATE_TRUNC('month', b.slot_date::timestamp) AS month,
  COUNT(*) FILTER (WHERE b.status = 'completed') AS bookings_completed,
  COUNT(*) FILTER (WHERE b.status = 'no_show') AS no_shows,
  SUM(b.total_price) FILTER (WHERE b.status = 'completed') AS revenue_completed,
  SUM(b.staff_payout) FILTER (WHERE b.status = 'completed') AS staff_payout_total,
  SUM(b.agency_share) FILTER (WHERE b.status = 'completed') AS agency_share_total
FROM bookings b
LEFT JOIN staff s ON s.id = b.staff_id
GROUP BY b.tenant_id, b.staff_id, s.pseudonym, s.btw_exempt,
         DATE_TRUNC('month', b.slot_date::timestamp);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_bookings_staff_date ON bookings (staff_id, slot_date);
CREATE INDEX idx_bookings_tenant_status ON bookings (tenant_id, status);
CREATE INDEX idx_bookings_reminder ON bookings (tenant_id, slot_date, reminder_sent) WHERE status = 'confirmed';
CREATE INDEX idx_staff_schedule_staff ON staff_schedule (staff_id);
CREATE INDEX idx_staff_exceptions_staff_date ON staff_exceptions (staff_id, exception_date);
CREATE INDEX idx_agent_notifications_tenant_unread ON agent_notifications (tenant_id, is_resolved);
CREATE INDEX idx_client_ratings_client ON client_ratings (client_id);
CREATE INDEX idx_guest_clients_tenant_email ON guest_clients (tenant_id, email);
CREATE INDEX idx_guest_blocks_tenant_email ON guest_blocks (tenant_id, email);

-- ============================================================================
-- JWT CUSTOM CLAIMS FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  user_role text;
  user_tenant_id uuid;
  user_staff_id uuid;
  user_client_id uuid;
  user_email text;
BEGIN
  claims := event->'claims';
  user_email := event->'claims'->>'email';

  -- Check if user is an agent
  SELECT a.tenant_id INTO user_tenant_id
  FROM agents a
  WHERE a.email = user_email
  LIMIT 1;

  IF user_tenant_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata}',
      coalesce(claims->'app_metadata', '{}'::jsonb) ||
      jsonb_build_object('tenant_id', user_tenant_id::text, 'user_role', 'agent'));
    RETURN jsonb_set(event, '{claims}', claims);
  END IF;

  -- Check if user is a staff member
  SELECT s.tenant_id, s.id INTO user_tenant_id, user_staff_id
  FROM staff s
  JOIN auth.users u ON u.id = s.id
  WHERE u.email = user_email
  LIMIT 1;

  IF user_tenant_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata}',
      coalesce(claims->'app_metadata', '{}'::jsonb) ||
      jsonb_build_object('tenant_id', user_tenant_id::text, 'user_role', 'staff', 'staff_id', user_staff_id::text));
    RETURN jsonb_set(event, '{claims}', claims);
  END IF;

  -- Check if user is a client (account mode)
  SELECT c.tenant_id, c.id INTO user_tenant_id, user_client_id
  FROM clients c
  WHERE c.email = user_email
  LIMIT 1;

  IF user_tenant_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata}',
      coalesce(claims->'app_metadata', '{}'::jsonb) ||
      jsonb_build_object('tenant_id', user_tenant_id::text, 'user_role', 'client', 'client_id', user_client_id::text));
    RETURN jsonb_set(event, '{claims}', claims);
  END IF;

  RETURN event;
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT SELECT ON public.agents TO supabase_auth_admin;
GRANT SELECT ON public.staff TO supabase_auth_admin;
GRANT SELECT ON public.clients TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
