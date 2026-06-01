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
  service: string;
  service_plural: string;
  /** Label for booking_notes field */
  booking_notes_label: string;
  /** Placeholder for booking_notes field */
  booking_notes_placeholder: string;
  /** e.g. "Agency" | "Studio" */
  operator: string;
}

export interface VerticalDefaults {
  client_mode: ClientMode;
  booking_confirm_mode: BookingConfirmMode;
  slot_minutes: number;
  booking_notes_required: boolean;
  age_gate_minimum: number;
  require_age_confirm: boolean;
  pricing_enabled: boolean;
}

export interface WizardStepConfig {
  id: string;
  title: string;
  description: string;
}

export interface VerticalWizard {
  steps: WizardStepConfig[];
}

export interface VerticalConfig {
  id: VerticalId;
  label: string;
  terminology: VerticalTerminology;
  defaults: VerticalDefaults;
  wizard: VerticalWizard;
  /** Pre-seeded service tag names shown during onboarding */
  seed_tags: string[];
  /** Whether deposits are configurable for this vertical */
  deposits_supported: boolean;
}
