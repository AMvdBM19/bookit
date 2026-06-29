-- Phase 20-A1: booking_rescheduled notification template.
-- Seed an email + WhatsApp template for every existing tenant so the
-- reschedule API (Phase 20-A2) can dispatch on both channels. Idempotent:
-- skips tenants that already have a row for the (event_type, channel) pair.

INSERT INTO notification_templates (tenant_id, event_type, channel, subject, body, is_active)
SELECT t.id, 'booking_rescheduled', 'email',
  'Appointment rescheduled — [agency_name]',
  E'Hi [client_name],\n\nYour appointment has been rescheduled.\n\nNew date: [date] at [time]\nWith: [staff_name]\nServices: [services]\n\nSee you then,\n[agency_name]',
  true
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM notification_templates nt
  WHERE nt.tenant_id = t.id
    AND nt.event_type = 'booking_rescheduled'
    AND nt.channel = 'email'
);

INSERT INTO notification_templates (tenant_id, event_type, channel, subject, body, is_active)
SELECT t.id, 'booking_rescheduled', 'whatsapp',
  NULL,
  'Hi [client_name], your appointment has been rescheduled to [date] at [time] with [staff_name]. See you then! [agency_name]',
  true
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM notification_templates nt
  WHERE nt.tenant_id = t.id
    AND nt.event_type = 'booking_rescheduled'
    AND nt.channel = 'whatsapp'
);
