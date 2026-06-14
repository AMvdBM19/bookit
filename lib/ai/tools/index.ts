import type { AITool } from '../adapter';
import type { ToolDefinition } from './types';

export type { ToolDefinition, ToolContext, ToolResult } from './types';

export type ToolRegistry = Record<string, ToolDefinition>;

/**
 * Registry of assistant tools, keyed by tool name. Intentionally empty —
 * the planned catalog lives in ai-docs/tools-reference.md and tools are
 * added here as they ship.
 */
export const TOOL_REGISTRY: ToolRegistry = {
  // PLANNED (Phase 15-B7, not yet active — confirmation-gated write tool):
  // edit_booking — PATCH /api/{slug}/bookings/{bookingId}/edit
  //   Edits an existing booking's services, notes, or price (recomputed
  //   from base rate + tag extras unless overridden). Same status window
  //   as the UI: pending_staff, confirmed, completed within 24h. Every
  //   edit lands in the booking_edits audit trail.
  //
  // PLANNED (Phase 17-D, read tool):
  // get_analytics — GET /api/{slug}/analytics?period=7d|30d|90d
  //   Returns KPIs (bookings, revenue, completion/no-show rates, avg per
  //   staff) and chart series for advice. Read-only, agent-scoped.
  //
  // PLANNED (Phase 17-B, confirmation-gated write tool):
  // create_payment_link — POST on the payments routes
  //   Generates/refreshes a Mollie deposit checkout link for a booking
  //   (only when the tenant has an active Mollie integration and the
  //   booking requires a deposit).
};

/** Wire specs for every registered tool, for the adapter request. */
export function getToolSpecs(): AITool[] {
  return Object.values(TOOL_REGISTRY).map(t => t.spec);
}

export function getTool(name: string): ToolDefinition | undefined {
  return TOOL_REGISTRY[name];
}
