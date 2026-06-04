-- Book-IT ERP — Seed Data
-- Two demo tenants: inkhaus (tattoo, guest mode) + velours-demo (adult_services, account mode)
-- Auth users created via seed-auth.ts — all passwords: Test1234!

-- ============================================================================
-- TENANT 1: inkhaus (tattoo vertical, guest mode, staff_must_accept)
-- ============================================================================
INSERT INTO tenants (id, name, slug, vertical, client_mode, kvk_number, registered_domain, domain_verified, is_active, wizard_completed)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Inkhaus Studio',
  'inkhaus',
  'tattoo',
  'guest',
  '12345678',
  'inkhaus.nl',
  TRUE,
  TRUE,
  TRUE
);

INSERT INTO tenant_settings (
  tenant_id, agency_display_name, brand_color, erp_theme,
  booking_confirm_mode,
  base_rate_per_30min, staff_payout_pct, agency_share_pct,
  currency, tax_rate_pct, tax_label, tax_period,
  default_slot_minutes, min_lead_time_hours, max_booking_days_ahead,
  offline_behaviour, no_show_revenue_policy, client_approval_mode,
  age_gate_minimum, require_age_confirm,
  widget_layout, widget_primary_color, widget_accent_color, widget_bg,
  max_staff, staff_kpi_visible
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Inkhaus Studio',
  '#1A1A2E', 'dark',
  'staff_must_accept',
  80.00, 70.00, 30.00,
  'EUR', 21.00, 'BTW', 'quarterly',
  60, 48, 90,
  'require_acknowledgement', 'zero', 'manual',
  18, TRUE,
  'grid', '#E94560', '#C62A47', 'dark',
  10, TRUE
);

-- Agent for inkhaus
INSERT INTO agents (id, tenant_id, email, name, phone)
VALUES (
  'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'agent@inkhaus.nl',
  'Lotte van der Berg',
  '+31612345678'
);

-- Service Tags (tattoo styles) — inkhaus
INSERT INTO service_tags (id, tenant_id, name, description, extra_price, display_order) VALUES
  ('1a611111-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'Traditional', 'Classic bold lines and colors', 0.00, 1),
  ('1a611111-0002-0002-0002-000000000002', '11111111-1111-1111-1111-111111111111', 'Fine Line', 'Delicate, detailed linework', 0.00, 2),
  ('1a611111-0003-0003-0003-000000000003', '11111111-1111-1111-1111-111111111111', 'Blackwork', 'Bold black ink designs', 0.00, 3),
  ('1a611111-0004-0004-0004-000000000004', '11111111-1111-1111-1111-111111111111', 'Realism', 'Photo-realistic portrait and detail work', 20.00, 4),
  ('1a611111-0005-0005-0005-000000000005', '11111111-1111-1111-1111-111111111111', 'Geometric', 'Sacred geometry and patterns', 0.00, 5),
  ('1a611111-0006-0006-0006-000000000006', '11111111-1111-1111-1111-111111111111', 'Japanese', 'Traditional Japanese irezumi', 10.00, 6),
  ('1a611111-0007-0007-0007-000000000007', '11111111-1111-1111-1111-111111111111', 'Cover-up', 'Cover existing tattoo (price varies)', 30.00, 7);

-- Artists — inkhaus (2 artists with social_links)
INSERT INTO staff (id, tenant_id, pseudonym, real_name, age, nationality, gender, languages, bio, photo_urls, social_links, status, btw_exempt, wizard_completed, first_login, created_by_agent_id) VALUES
  ('51f11111-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111',
   'Mara Ink', 'Mara Jansen', 29, 'Dutch', 'female', ARRAY['Dutch','English'],
   'Specializing in fine line and botanical tattoos. Based in Amsterdam.',
   ARRAY['/demo/mara-1.jpg', '/demo/mara-2.jpg'],
   '{"instagram": "@maraink.tattoo", "tiktok": "@maraink", "website": "https://maraink.nl"}'::jsonb,
   'active', FALSE, TRUE, FALSE,
   'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('51f11111-0002-0002-0002-000000000002', '11111111-1111-1111-1111-111111111111',
   'Kai Dark', 'Kai de Bruijn', 34, 'Dutch', 'male', ARRAY['Dutch','English','German'],
   'Blackwork and geometric specialist. 10+ years experience.',
   ARRAY['/demo/kai-1.jpg', '/demo/kai-2.jpg'],
   '{"instagram": "@kai.dark.tattoo", "facebook": "KaiDarkTattoo"}'::jsonb,
   'active', TRUE, TRUE, FALSE,
   'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- Staff-Tag assignments — inkhaus
INSERT INTO staff_service_tags (staff_id, tag_id, tenant_id) VALUES
  ('51f11111-0001-0001-0001-000000000001', '1a611111-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111'),
  ('51f11111-0001-0001-0001-000000000001', '1a611111-0002-0002-0002-000000000002', '11111111-1111-1111-1111-111111111111'),
  ('51f11111-0001-0001-0001-000000000001', '1a611111-0005-0005-0005-000000000005', '11111111-1111-1111-1111-111111111111'),
  ('51f11111-0002-0002-0002-000000000002', '1a611111-0003-0003-0003-000000000003', '11111111-1111-1111-1111-111111111111'),
  ('51f11111-0002-0002-0002-000000000002', '1a611111-0005-0005-0005-000000000005', '11111111-1111-1111-1111-111111111111'),
  ('51f11111-0002-0002-0002-000000000002', '1a611111-0006-0006-0006-000000000006', '11111111-1111-1111-1111-111111111111'),
  ('51f11111-0002-0002-0002-000000000002', '1a611111-0007-0007-0007-000000000007', '11111111-1111-1111-1111-111111111111');

-- Staff schedules — inkhaus
INSERT INTO staff_schedule (tenant_id, staff_id, day_of_week, start_time, end_time) VALUES
  -- Mara: Tue-Sat 10:00-18:00
  ('11111111-1111-1111-1111-111111111111', '51f11111-0001-0001-0001-000000000001', 2, '10:00', '18:00'),
  ('11111111-1111-1111-1111-111111111111', '51f11111-0001-0001-0001-000000000001', 3, '10:00', '18:00'),
  ('11111111-1111-1111-1111-111111111111', '51f11111-0001-0001-0001-000000000001', 4, '10:00', '18:00'),
  ('11111111-1111-1111-1111-111111111111', '51f11111-0001-0001-0001-000000000001', 5, '10:00', '18:00'),
  ('11111111-1111-1111-1111-111111111111', '51f11111-0001-0001-0001-000000000001', 6, '10:00', '16:00'),
  -- Kai: Mon-Fri 12:00-20:00
  ('11111111-1111-1111-1111-111111111111', '51f11111-0002-0002-0002-000000000002', 1, '12:00', '20:00'),
  ('11111111-1111-1111-1111-111111111111', '51f11111-0002-0002-0002-000000000002', 2, '12:00', '20:00'),
  ('11111111-1111-1111-1111-111111111111', '51f11111-0002-0002-0002-000000000002', 3, '12:00', '20:00'),
  ('11111111-1111-1111-1111-111111111111', '51f11111-0002-0002-0002-000000000002', 4, '12:00', '20:00'),
  ('11111111-1111-1111-1111-111111111111', '51f11111-0002-0002-0002-000000000002', 5, '12:00', '20:00');

-- Guest clients — inkhaus
INSERT INTO guest_clients (id, tenant_id, email, name, phone, wa_opt_in, booking_count, last_seen_at) VALUES
  ('65111111-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111',
   'emma@example.com', 'Emma Visser', '+31612111001', TRUE, 2, NOW() - INTERVAL '5 days'),
  ('65111111-0002-0002-0002-000000000002', '11111111-1111-1111-1111-111111111111',
   'tom@example.com', 'Tom Bakker', '+31612111002', FALSE, 1, NOW() - INTERVAL '20 days');

-- Bookings — inkhaus (mix of statuses)
INSERT INTO bookings (
  id, tenant_id, staff_id, guest_client_id, booking_source,
  slot_date, slot_start, slot_end, duration_minutes,
  location_type, booking_notes,
  base_rate_per_30, tag_extras_total, total_price, staff_payout, agency_share,
  status, no_show_revenue_policy, requested_at, confirmed_at, completed_at, reminder_sent
) VALUES
  -- Completed appointment
  ('b0011111-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111',
   '51f11111-0001-0001-0001-000000000001', '65111111-0001-0001-0001-000000000001', 'client_request',
   CURRENT_DATE - 7, '11:00:00', '13:00:00', 120,
   'incall', 'Small floral fine line piece on inner forearm, about 8cm, black ink only.',
   80.00, 0.00, 160.00, 112.00, 48.00,
   'completed', 'zero', NOW() - INTERVAL '10 days', NOW() - INTERVAL '9 days', NOW() - INTERVAL '7 days', TRUE),
  -- Confirmed upcoming
  ('b0011111-0002-0002-0002-000000000002', '11111111-1111-1111-1111-111111111111',
   '51f11111-0002-0002-0002-000000000002', '65111111-0002-0002-0002-000000000002', 'client_request',
   CURRENT_DATE + 3, '14:00:00', '17:00:00', 180,
   'incall', 'Blackwork sleeve continuation — geometric patterns on upper arm matching existing work.',
   80.00, 0.00, 240.00, 168.00, 72.00,
   'confirmed', 'zero', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', NULL, FALSE),
  -- Pending staff review
  ('b0011111-0003-0003-0003-000000000003', '11111111-1111-1111-1111-111111111111',
   '51f11111-0001-0001-0001-000000000001', '65111111-0001-0001-0001-000000000001', 'client_request',
   CURRENT_DATE + 10, '10:00:00', '12:00:00', 120,
   'incall', 'Continuation of the floral piece — adding leaves and a small butterfly. Same style as last session.',
   80.00, 0.00, 160.00, 112.00, 48.00,
   'pending_staff', 'zero', NOW(), NULL, NULL, FALSE);

-- Booking service tags — inkhaus
INSERT INTO booking_service_tags (tenant_id, booking_id, tag_id, tag_name, extra_price) VALUES
  ('11111111-1111-1111-1111-111111111111', 'b0011111-0001-0001-0001-000000000001', '1a611111-0002-0002-0002-000000000002', 'Fine Line', 0.00),
  ('11111111-1111-1111-1111-111111111111', 'b0011111-0002-0002-0002-000000000002', '1a611111-0003-0003-0003-000000000003', 'Blackwork', 0.00),
  ('11111111-1111-1111-1111-111111111111', 'b0011111-0002-0002-0002-000000000002', '1a611111-0005-0005-0005-000000000005', 'Geometric', 0.00);

-- Agent notifications — inkhaus
INSERT INTO agent_notifications (tenant_id, type, priority, message, linked_entity, linked_id, is_read, is_resolved) VALUES
  ('11111111-1111-1111-1111-111111111111', 'booking_request', 2,
   'New appointment request for Mara Ink from Emma Visser on ' || (CURRENT_DATE + 10)::text || ' at 10:00',
   'booking', 'b0011111-0003-0003-0003-000000000003', FALSE, FALSE);

-- Notification templates — inkhaus
INSERT INTO notification_templates (tenant_id, event_type, channel, subject, body) VALUES
  ('11111111-1111-1111-1111-111111111111', 'booking_confirmed', 'whatsapp', NULL,
   'Hi [client_name], your appointment with [staff_name] on [date] at [time] ([duration] min) is confirmed. See you at Inkhaus! [agency_name]'),
  ('11111111-1111-1111-1111-111111111111', 'booking_declined', 'whatsapp', NULL,
   'Hi [client_name], unfortunately [staff_name] is unavailable for your requested time. Please try another slot. [agency_name]'),
  ('11111111-1111-1111-1111-111111111111', 'booking_cancelled', 'whatsapp', NULL,
   'Hi [client_name], your appointment on [date] has been cancelled. Please contact us to rebook. [agency_name]'),
  ('11111111-1111-1111-1111-111111111111', 'booking_reminder', 'whatsapp', NULL,
   'Reminder: Your tattoo appointment with [staff_name] is coming up on [date] at [time]. [agency_name]'),
  ('11111111-1111-1111-1111-111111111111', 'booking_confirmed', 'email', 'Appointment Confirmed — Inkhaus Studio',
   'Hi [client_name],\n\nYour appointment with [staff_name] on [date] at [time] ([duration] min) is confirmed.\n\nRemember to:\n- Stay hydrated and eat beforehand\n- Wear comfortable clothing\n- Bring your reference images\n\nSee you soon!\nInkhaus Studio');

-- ============================================================================
-- TENANT 2: velours-demo (adult_services vertical, account mode, staff_must_accept)
-- ============================================================================
INSERT INTO tenants (id, name, slug, vertical, client_mode, kvk_number, license_number, registered_domain, domain_verified, is_active, wizard_completed)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'Velours Amsterdam',
  'velours-demo',
  'adult_services',
  'account',
  '87654321',
  'AMS-2026-001',
  'velours-amsterdam.nl',
  TRUE,
  TRUE,
  TRUE
);

INSERT INTO tenant_settings (
  tenant_id, agency_display_name, brand_color, erp_theme,
  booking_confirm_mode,
  base_rate_per_30min, staff_payout_pct, agency_share_pct,
  currency, tax_rate_pct, tax_label, tax_period,
  default_slot_minutes, min_lead_time_hours, max_booking_days_ahead,
  offline_behaviour, no_show_revenue_policy, client_approval_mode,
  age_gate_minimum, require_age_confirm,
  widget_layout, widget_primary_color, widget_accent_color, widget_bg,
  max_staff, staff_kpi_visible
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  'Velours Amsterdam',
  '#2BB673', 'dark',
  'staff_must_accept',
  60.00, 70.00, 30.00,
  'EUR', 21.00, 'BTW', 'quarterly',
  30, 2, 30,
  'auto_approve', 'zero', 'manual',
  21, TRUE,
  'grid', '#2BB673', '#1D9E75', 'white',
  15, TRUE
);

-- Agent for velours-demo
INSERT INTO agents (id, tenant_id, email, name, phone)
VALUES (
  'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '22222222-2222-2222-2222-222222222222',
  'agent@velours-demo.nl',
  'Sophie de Vries',
  '+31698765432'
);

-- Service Tags — velours-demo
INSERT INTO service_tags (id, tenant_id, name, description, extra_price, display_order) VALUES
  ('1a622222-0001-0001-0001-000000000001', '22222222-2222-2222-2222-222222222222', 'GFE', 'Girlfriend experience', 20.00, 1),
  ('1a622222-0002-0002-0002-000000000002', '22222222-2222-2222-2222-222222222222', 'Massage', 'Full body massage', 15.00, 2),
  ('1a622222-0003-0003-0003-000000000003', '22222222-2222-2222-2222-222222222222', 'Duo', 'Two workers together', 50.00, 3),
  ('1a622222-0004-0004-0004-000000000004', '22222222-2222-2222-2222-222222222222', 'Dinner Date', 'Dinner companion', 30.00, 4);

-- Workers — velours-demo (2 workers with social_links)
INSERT INTO staff (id, tenant_id, pseudonym, real_name, age, nationality, gender, languages, bio, photo_urls, social_links, status, btw_exempt, wizard_completed, first_login, created_by_agent_id) VALUES
  ('51f22222-0001-0001-0001-000000000001', '22222222-2222-2222-2222-222222222222',
   'Luna', NULL, 25, 'Dutch', 'female', ARRAY['Dutch','English','French'],
   'Charming and elegant, Luna brings warmth to every encounter.',
   ARRAY['/demo/luna-1.jpg'],
   '{"instagram": "@luna.velours"}'::jsonb,
   'active', FALSE, TRUE, FALSE,
   'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('51f22222-0002-0002-0002-000000000002', '22222222-2222-2222-2222-222222222222',
   'Valentina', NULL, 28, 'Romanian', 'female', ARRAY['Romanian','English','Dutch'],
   'Exotic beauty with a passion for life.',
   ARRAY['/demo/valentina-1.jpg'],
   '{}'::jsonb,
   'active', TRUE, TRUE, FALSE,
   'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- Staff-Tag assignments — velours-demo
INSERT INTO staff_service_tags (staff_id, tag_id, tenant_id) VALUES
  ('51f22222-0001-0001-0001-000000000001', '1a622222-0001-0001-0001-000000000001', '22222222-2222-2222-2222-222222222222'),
  ('51f22222-0001-0001-0001-000000000001', '1a622222-0002-0002-0002-000000000002', '22222222-2222-2222-2222-222222222222'),
  ('51f22222-0001-0001-0001-000000000001', '1a622222-0004-0004-0004-000000000004', '22222222-2222-2222-2222-222222222222'),
  ('51f22222-0002-0002-0002-000000000002', '1a622222-0001-0001-0001-000000000001', '22222222-2222-2222-2222-222222222222'),
  ('51f22222-0002-0002-0002-000000000002', '1a622222-0003-0003-0003-000000000003', '22222222-2222-2222-2222-222222222222');

-- Staff schedules — velours-demo
INSERT INTO staff_schedule (tenant_id, staff_id, day_of_week, start_time, end_time) VALUES
  ('22222222-2222-2222-2222-222222222222', '51f22222-0001-0001-0001-000000000001', 1, '10:00', '22:00'),
  ('22222222-2222-2222-2222-222222222222', '51f22222-0001-0001-0001-000000000001', 2, '10:00', '22:00'),
  ('22222222-2222-2222-2222-222222222222', '51f22222-0001-0001-0001-000000000001', 3, '10:00', '22:00'),
  ('22222222-2222-2222-2222-222222222222', '51f22222-0001-0001-0001-000000000001', 4, '10:00', '22:00'),
  ('22222222-2222-2222-2222-222222222222', '51f22222-0001-0001-0001-000000000001', 5, '10:00', '22:00'),
  ('22222222-2222-2222-2222-222222222222', '51f22222-0002-0002-0002-000000000002', 2, '12:00', '20:00'),
  ('22222222-2222-2222-2222-222222222222', '51f22222-0002-0002-0002-000000000002', 3, '12:00', '20:00'),
  ('22222222-2222-2222-2222-222222222222', '51f22222-0002-0002-0002-000000000002', 4, '12:00', '20:00'),
  ('22222222-2222-2222-2222-222222222222', '51f22222-0002-0002-0002-000000000002', 5, '12:00', '20:00'),
  ('22222222-2222-2222-2222-222222222222', '51f22222-0002-0002-0002-000000000002', 6, '12:00', '20:00');

-- Clients — velours-demo (account mode: approval flow)
INSERT INTO clients (id, tenant_id, display_name, real_name, email, phone, status, wa_opt_in, created_at, approved_at) VALUES
  ('c1122222-0001-0001-0001-000000000001', '22222222-2222-2222-2222-222222222222',
   'Mark V.', 'Mark Vermeer', 'mark@example.com', '+31620001111', 'approved', TRUE,
   NOW() - INTERVAL '30 days', NOW() - INTERVAL '29 days'),
  ('c1122222-0002-0002-0002-000000000002', '22222222-2222-2222-2222-222222222222',
   'Peter K.', 'Peter Koeman', 'peter@example.com', '+31620002222', 'pending', FALSE,
   NOW() - INTERVAL '2 days', NULL);

-- Client status log — velours-demo
INSERT INTO client_status_log (tenant_id, client_id, from_status, to_status, reason, changed_by, changed_by_agent_id) VALUES
  ('22222222-2222-2222-2222-222222222222', 'c1122222-0001-0001-0001-000000000001', NULL, 'pending', 'Pending agent review', 'system', NULL),
  ('22222222-2222-2222-2222-222222222222', 'c1122222-0001-0001-0001-000000000001', 'pending', 'approved', 'Approved by agent', 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('22222222-2222-2222-2222-222222222222', 'c1122222-0002-0002-0002-000000000002', NULL, 'pending', 'Pending agent review', 'system', NULL);

-- Booking — velours-demo
INSERT INTO bookings (
  id, tenant_id, staff_id, client_id, booking_source,
  slot_date, slot_start, slot_end, duration_minutes,
  location_type,
  base_rate_per_30, tag_extras_total, total_price, staff_payout, agency_share,
  status, no_show_revenue_policy, requested_at, confirmed_at, reminder_sent
) VALUES
  ('b0022222-0001-0001-0001-000000000001', '22222222-2222-2222-2222-222222222222',
   '51f22222-0001-0001-0001-000000000001', 'c1122222-0001-0001-0001-000000000001', 'client_request',
   CURRENT_DATE + 2, '16:00:00', '17:00:00', 60,
   'incall',
   60.00, 20.00, 140.00, 98.00, 42.00,
   'confirmed', 'zero', NOW() - INTERVAL '1 day', NOW(), FALSE);

INSERT INTO booking_service_tags (tenant_id, booking_id, tag_id, tag_name, extra_price) VALUES
  ('22222222-2222-2222-2222-222222222222', 'b0022222-0001-0001-0001-000000000001', '1a622222-0001-0001-0001-000000000001', 'GFE', 20.00);

-- Agent notifications — velours-demo
INSERT INTO agent_notifications (tenant_id, type, priority, message, linked_entity, linked_id, is_read, is_resolved) VALUES
  ('22222222-2222-2222-2222-222222222222', 'client_signup', 1,
   'New client registration: Peter K. Review and approve or reject.',
   'client', 'c1122222-0002-0002-0002-000000000002', FALSE, FALSE);

-- Notification templates — velours-demo
INSERT INTO notification_templates (tenant_id, event_type, channel, subject, body) VALUES
  ('22222222-2222-2222-2222-222222222222', 'booking_confirmed', 'whatsapp', NULL,
   'Hi [client_name], your booking with [staff_name] on [date] at [time] ([duration] min) is confirmed. [agency_name]'),
  ('22222222-2222-2222-2222-222222222222', 'booking_declined', 'whatsapp', NULL,
   'Hi [client_name], unfortunately [staff_name] is not available at your requested time. Please try another slot. [agency_name]'),
  ('22222222-2222-2222-2222-222222222222', 'booking_cancelled', 'whatsapp', NULL,
   'Hi [client_name], your booking on [date] has been cancelled. [agency_name]'),
  ('22222222-2222-2222-2222-222222222222', 'booking_reminder', 'whatsapp', NULL,
   'Reminder: Your booking with [staff_name] is on [date] at [time]. [agency_name]'),
  ('22222222-2222-2222-2222-222222222222', 'client_approved', 'whatsapp', NULL,
   'Hi [client_name], your account at [agency_name] has been approved! You can now browse and book.'),
  ('22222222-2222-2222-2222-222222222222', 'client_approved', 'email', 'Account Approved — Velours Amsterdam',
   'Dear [client_name],\n\nYour account has been approved. You can now browse our workers and make bookings.\n\nWelcome!\nVelours Amsterdam');

-- ============================================================================
-- LOCKED SETTINGS (post-wizard completion)
-- ============================================================================
INSERT INTO tenant_locked_settings (tenant_id, field_name, locked_by) VALUES
  ('11111111-1111-1111-1111-111111111111', 'currency', 'wizard'),
  ('11111111-1111-1111-1111-111111111111', 'staff_payout_pct', 'wizard'),
  ('11111111-1111-1111-1111-111111111111', 'agency_share_pct', 'wizard'),
  ('11111111-1111-1111-1111-111111111111', 'tax_rate_pct', 'wizard'),
  ('11111111-1111-1111-1111-111111111111', 'tax_label', 'wizard'),
  ('11111111-1111-1111-1111-111111111111', 'age_gate_minimum', 'wizard'),
  ('11111111-1111-1111-1111-111111111111', 'gdpr_retention_years', 'wizard'),
  ('22222222-2222-2222-2222-222222222222', 'currency', 'wizard'),
  ('22222222-2222-2222-2222-222222222222', 'staff_payout_pct', 'wizard'),
  ('22222222-2222-2222-2222-222222222222', 'agency_share_pct', 'wizard'),
  ('22222222-2222-2222-2222-222222222222', 'tax_rate_pct', 'wizard'),
  ('22222222-2222-2222-2222-222222222222', 'tax_label', 'wizard'),
  ('22222222-2222-2222-2222-222222222222', 'age_gate_minimum', 'wizard'),
  ('22222222-2222-2222-2222-222222222222', 'gdpr_retention_years', 'wizard');
