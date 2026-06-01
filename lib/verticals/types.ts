export type VerticalId = 'adult_services' | 'tattoo';

export type ClientMode = 'account' | 'guest';
export type BookingConfirmMode = 'staff_must_accept' | 'auto_confirm';

export interface VerticalTerminology {
  /** e.g. "Worker" | "Artist" */
  staff: string;
  staff_plural: string;
  /** e.g. "Client" | "Guest" */
  client: string;
  client_plural: string;
  /** e.g. "Booking" | "Appointment" | "Session" */
  booking: string;
  booking_plural: string;
  /** e.g. "Service" | "Style" | "Tag" */
  service_tag: string;
  service_plural: string;
  /** Placeholder for booking_notes field */
  booking_notes_placeholder: string;
  /** e.g. "Agent" | "Manager" */
  operator: string;
}

export interface VerticalDefaults {
  client_mode: ClientMode;
  booking_confirm_mode: BookingConfirmMode;
  client_approval_mode: 'manual' | 'auto';
  default_slot_minutes: number;
  require_booking_notes: boolean;
  booking_notes_label: string;
  age_gate_minimum: number | null;
  require_age_confirm: boolean;
  pricing_enabled: boolean;
}

export interface VerticalConfig {
  id: VerticalId;
  label: string;
  terminology: VerticalTerminology;
  defaults: VerticalDefaults;
  show_kvk_field: boolean;
  show_license_field: boolean;
  show_bsn_on_staff: boolean;
  show_gdpr_photo_consent: boolean;
  show_age_gate_step: boolean;
  staff_require_pseudonym: boolean;
  /** Pre-seeded service tag names shown during onboarding */
  seed_tags: string[];
  /** Whether deposits are configurable for this vertical */
  deposits_supported: boolean;
}
