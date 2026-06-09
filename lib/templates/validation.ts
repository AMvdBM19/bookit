// Shared validators for industry_templates / tenant_config JSONB payloads.
// Each validator returns an error string, or null when the payload is valid.

import {
  TERMINOLOGY_KEYS,
  FEATURE_FLAG_KEYS,
  COMPLIANCE_FLAG_KEYS,
} from '@/lib/types/tenant-config';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** All 8 terminology keys present and every value a non-empty string. */
export function validateTerminology(value: unknown): string | null {
  if (!isPlainObject(value)) return 'terminology must be an object';
  for (const key of TERMINOLOGY_KEYS) {
    const v = value[key];
    if (typeof v !== 'string' || v.trim() === '') {
      return `terminology.${key} must be a non-empty string`;
    }
  }
  return null;
}

/** All feature flag keys present with correct types. */
export function validateFeatureFlags(value: unknown): string | null {
  if (!isPlainObject(value)) return 'feature_flags must be an object';
  for (const key of FEATURE_FLAG_KEYS) {
    if (!(key in value)) return `feature_flags.${key} is required`;
  }
  if (typeof value.show_age_gate_step !== 'boolean') return 'feature_flags.show_age_gate_step must be a boolean';
  if (value.age_gate_minimum !== null && typeof value.age_gate_minimum !== 'number') {
    return 'feature_flags.age_gate_minimum must be a number or null';
  }
  if (typeof value.staff_require_pseudonym !== 'boolean') return 'feature_flags.staff_require_pseudonym must be a boolean';
  if (typeof value.deposits_supported !== 'boolean') return 'feature_flags.deposits_supported must be a boolean';
  if (typeof value.show_price_to_client !== 'boolean') return 'feature_flags.show_price_to_client must be a boolean';
  if (typeof value.require_booking_notes !== 'boolean') return 'feature_flags.require_booking_notes must be a boolean';
  if (typeof value.booking_notes_label !== 'string') return 'feature_flags.booking_notes_label must be a string';
  if (typeof value.booking_notes_placeholder !== 'string') return 'feature_flags.booking_notes_placeholder must be a string';
  if (value.booking_completion_by !== 'admin_only' && value.booking_completion_by !== 'staff_and_admin') {
    return 'feature_flags.booking_completion_by must be "admin_only" or "staff_and_admin"';
  }
  return null;
}

/** All compliance flag keys present and boolean. */
export function validateComplianceFlags(value: unknown): string | null {
  if (!isPlainObject(value)) return 'compliance_flags must be an object';
  for (const key of COMPLIANCE_FLAG_KEYS) {
    if (typeof value[key] !== 'boolean') return `compliance_flags.${key} must be a boolean`;
  }
  return null;
}

/** Validates default_settings enums and numeric fields. */
export function validateDefaultSettings(value: unknown): string | null {
  if (!isPlainObject(value)) return 'default_settings must be an object';
  if (value.client_mode !== 'account' && value.client_mode !== 'guest') {
    return 'default_settings.client_mode must be "account" or "guest"';
  }
  if (
    value.booking_confirm_mode !== 'staff_must_accept' &&
    value.booking_confirm_mode !== 'auto_confirm'
  ) {
    return 'default_settings.booking_confirm_mode must be "staff_must_accept" or "auto_confirm"';
  }
  if (value.client_approval_mode !== 'manual' && value.client_approval_mode !== 'auto') {
    return 'default_settings.client_approval_mode must be "manual" or "auto"';
  }
  if (typeof value.default_slot_minutes !== 'number') return 'default_settings.default_slot_minutes must be a number';
  if (typeof value.deposit_pct !== 'number') return 'default_settings.deposit_pct must be a number';
  if (typeof value.deposit_required_above_minutes !== 'number') {
    return 'default_settings.deposit_required_above_minutes must be a number';
  }
  return null;
}

/** Array of objects each with a non-empty string `name`. */
export function validateSeedTags(value: unknown): string | null {
  if (!Array.isArray(value)) return 'seed_tags must be an array';
  for (let i = 0; i < value.length; i++) {
    const tag = value[i];
    if (!isPlainObject(tag) || typeof tag.name !== 'string' || tag.name.trim() === '') {
      return `seed_tags[${i}].name must be a non-empty string`;
    }
  }
  return null;
}
