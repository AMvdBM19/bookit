// Shared effective-duration logic for per-service-duration bookings.
//
// A service tag contributes its duration to the booking length only when
// blocks_slot is true (Phase 19 A2). Non-blocking tags (blocks_slot=false) add
// price but no time — they are extras like "wax", "per wheel", etc. When every
// selected tag is non-blocking (sum is 0), the booking falls back to the
// tenant's default_slot_minutes. NULL duration on a blocking tag = a
// normal-length service, contributing the default slot length (not zero).
//
// Used by the availability APIs, the public book route and the widget so all
// three agree on the slot length and the 409 duration-mismatch guard.

export interface DurationTag {
  duration_minutes?: number | null;
  /** Defaults to true when the column is absent (pre-migration). */
  blocks_slot?: boolean | null;
}

export function effectiveDurationMinutes(
  tags: DurationTag[],
  defaultSlotMinutes: number
): number {
  const total = tags.reduce((sum, t) => {
    // Non-blocking tags add price, not time.
    if (t.blocks_slot === false) return sum;
    return sum + (typeof t.duration_minutes === 'number' ? t.duration_minutes : defaultSlotMinutes);
  }, 0);
  return total > 0 ? total : defaultSlotMinutes;
}
