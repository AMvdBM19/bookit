-- Phase 21-D1: GDPR client anonymization support.
-- Adds anonymized_at timestamp to clients and guest_clients so
-- tenant agents can trigger data erasure per GDPR Article 17.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ NULL;
ALTER TABLE guest_clients ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ NULL;
