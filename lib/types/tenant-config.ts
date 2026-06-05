// JSONB contract interfaces — shared between industry_templates and tenant_config

// Core scalar aliases. `vertical` on tenants is now the free-form template slug
// (kept as a column for back-compat); ClientMode / BookingConfirmMode remain
// constrained unions used across settings and auth.
export type VerticalId = string;
export type ClientMode = 'account' | 'guest';
export type BookingConfirmMode = 'staff_must_accept' | 'auto_confirm';

export interface Terminology {
  staff: string;
  staff_plural: string;
  client: string;
  client_plural: string;
  booking: string;
  booking_plural: string;
  operator: string;
  service_tag: string;
}

export interface FeatureFlags {
  show_age_gate_step: boolean;
  age_gate_minimum: number | null;
  staff_require_pseudonym: boolean;
  deposits_supported: boolean;
  show_price_to_client: boolean;
  require_booking_notes: boolean;
  booking_notes_label: string;
  booking_notes_placeholder: string;
}

export interface ComplianceFlags {
  show_kvk_field: boolean;
  show_license_field: boolean;
  show_bsn_on_staff: boolean;
  show_gdpr_photo_consent: boolean;
  require_terms_acceptance: boolean;
}

export interface DefaultSettings {
  client_mode: ClientMode;
  booking_confirm_mode: BookingConfirmMode;
  client_approval_mode: 'manual' | 'auto';
  default_slot_minutes: number;
  deposit_pct: number;
  deposit_required_above_minutes: number;
}

export interface SeedTag {
  name: string;
  description?: string;
}

export interface IndustryTemplate {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  icon: string;
  terminology: Terminology;
  feature_flags: FeatureFlags;
  compliance_flags: ComplianceFlags;
  default_settings: DefaultSettings;
  seed_tags: SeedTag[];
  is_active: boolean;
  is_system: boolean;
  sort_order: number;
  created_by: string | null;
  is_public: boolean;
  is_premium: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantConfig {
  id: string;
  tenant_id: string;
  source_template_slug: string | null;
  terminology: Terminology;
  feature_flags: FeatureFlags;
  compliance_flags: ComplianceFlags;
  created_at: string;
  updated_at: string;
}

// Validation helpers
export const TERMINOLOGY_KEYS: (keyof Terminology)[] = [
  'staff', 'staff_plural', 'client', 'client_plural',
  'booking', 'booking_plural', 'operator', 'service_tag'
];

export const FEATURE_FLAG_KEYS: (keyof FeatureFlags)[] = [
  'show_age_gate_step', 'age_gate_minimum', 'staff_require_pseudonym',
  'deposits_supported', 'show_price_to_client', 'require_booking_notes',
  'booking_notes_label', 'booking_notes_placeholder'
];

export const COMPLIANCE_FLAG_KEYS: (keyof ComplianceFlags)[] = [
  'show_kvk_field', 'show_license_field', 'show_bsn_on_staff',
  'show_gdpr_photo_consent', 'require_terms_acceptance'
];

export const DEFAULT_TERMINOLOGY: Terminology = {
  staff: 'Staff',
  staff_plural: 'Staff',
  client: 'Client',
  client_plural: 'Clients',
  booking: 'Booking',
  booking_plural: 'Bookings',
  operator: 'Manager',
  service_tag: 'Service',
};

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  show_age_gate_step: false,
  age_gate_minimum: null,
  staff_require_pseudonym: false,
  deposits_supported: false,
  show_price_to_client: false,
  require_booking_notes: false,
  booking_notes_label: 'Notes',
  booking_notes_placeholder: 'Any additional information...',
};

export const DEFAULT_COMPLIANCE_FLAGS: ComplianceFlags = {
  show_kvk_field: false,
  show_license_field: false,
  show_bsn_on_staff: false,
  show_gdpr_photo_consent: false,
  require_terms_acceptance: false,
};
