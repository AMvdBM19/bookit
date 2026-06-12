import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import type { AuthenticatedUser } from '@/lib/types/auth';
import type { FeatureFlags } from '@/lib/types/tenant-config';
import { DEFAULT_FEATURE_FLAGS } from '@/lib/types/tenant-config';

// Phase 15-B7: booking editing. Agents can always edit; staff only when the
// tenant's staff_can_edit_bookings flag is on, and only their own bookings.
// Editable: service tags, notes, and a price override. The price is
// recalculated from base rate + tag extras unless an explicit override is
// given. Editing never re-runs availability or duration validation, and is
// allowed on pending_staff, confirmed, and completed-within-24h bookings.

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const EDIT_WINDOW_AFTER_COMPLETION_MS = 24 * 60 * 60 * 1000;

interface LoadedBooking {
  id: string;
  tenant_id: string;
  staff_id: string | null;
  status: string;
  duration_minutes: number;
  booking_notes: string | null;
  total_price: number | string | null;
  completed_at: string | null;
  booking_service_tags: Array<{ tag_id: string | null; tag_name: string }>;
}

async function authorize(
  bookingId: string
): Promise<
  | { user: AuthenticatedUser; booking: LoadedBooking; flags: FeatureFlags }
  | NextResponse
> {
  let user: AuthenticatedUser;
  try {
    user = await requireRole(['agent', 'staff']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: booking } = await supabase
    .from('bookings')
    .select(
      'id, tenant_id, staff_id, status, duration_minutes, booking_notes, total_price, completed_at, booking_service_tags(tag_id, tag_name)'
    )
    .eq('id', bookingId)
    .single();

  if (!booking || booking.tenant_id !== user.tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: tenantConfig } = await supabase
    .from('tenant_config')
    .select('feature_flags')
    .eq('tenant_id', user.tenantId)
    .maybeSingle();
  const flags =
    (tenantConfig?.feature_flags as FeatureFlags | undefined) ?? DEFAULT_FEATURE_FLAGS;

  if (user.role === 'staff') {
    if (!flags.staff_can_edit_bookings) {
      return NextResponse.json({ error: 'Editing is not enabled for staff' }, { status: 403 });
    }
    if (booking.staff_id !== user.staffId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  return { user, booking: booking as unknown as LoadedBooking, flags };
}

function editabilityError(booking: LoadedBooking): string | null {
  if (booking.status === 'pending_staff' || booking.status === 'confirmed') return null;
  if (booking.status === 'completed') {
    const completedAt = booking.completed_at ? new Date(booking.completed_at).getTime() : NaN;
    if (
      Number.isFinite(completedAt) &&
      Date.now() - completedAt <= EDIT_WINDOW_AFTER_COMPLETION_MS
    ) {
      return null;
    }
    return 'Completed bookings can only be edited within 24 hours';
  }
  return `Bookings with status "${booking.status}" cannot be edited`;
}

// GET — edit context for the modal: current booking fields, the tenant's
// active tags, and pricing settings (works for staff too, who cannot use
// the agent-only tags API).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; bookingId: string }> }
) {
  const { bookingId } = await params;
  const auth = await authorize(bookingId);
  if (auth instanceof NextResponse) return auth;
  const { user, booking } = auth;

  const supabase = createServiceClient();
  const [{ data: tags }, { data: settings }] = await Promise.all([
    supabase
      .from('service_tags')
      .select('id, name, extra_price, is_active')
      .eq('tenant_id', user.tenantId)
      .eq('is_active', true)
      .order('display_order'),
    supabase
      .from('tenant_settings')
      .select('base_rate_per_30min, staff_payout_pct, agency_share_pct, currency')
      .eq('tenant_id', user.tenantId)
      .single(),
  ]);

  return NextResponse.json({
    booking: {
      id: booking.id,
      status: booking.status,
      duration_minutes: booking.duration_minutes,
      booking_notes: booking.booking_notes,
      total_price: booking.total_price,
      tag_ids: (booking.booking_service_tags ?? [])
        .map(t => t.tag_id)
        .filter((id): id is string => id !== null),
    },
    tags: tags ?? [],
    settings: settings ?? null,
    editable: editabilityError(booking) === null,
    editable_reason: editabilityError(booking),
  });
}

// PATCH — apply an edit. Body: { tag_ids?, booking_notes?, total_price? }.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; bookingId: string }> }
) {
  const { bookingId } = await params;
  const auth = await authorize(bookingId);
  if (auth instanceof NextResponse) return auth;
  const { user, booking } = auth;

  const blocked = editabilityError(booking);
  if (blocked) {
    return NextResponse.json({ error: blocked }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const wantsTags = Array.isArray(body.tag_ids);
  const wantsNotes = typeof body.booking_notes === 'string';
  const hasOverride = body.total_price !== undefined && body.total_price !== null;

  if (!wantsTags && !wantsNotes && !hasOverride) {
    return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 });
  }

  let overridePrice: number | null = null;
  if (hasOverride) {
    const n = Number(body.total_price);
    if (!Number.isFinite(n) || n < 0 || n > 1000000) {
      return NextResponse.json(
        { error: 'total_price must be a non-negative number' },
        { status: 400 }
      );
    }
    overridePrice = round2(n);
  }

  // Resolve the new tag set (tenant-scoped) and recalculate pricing from the
  // base rate + extras over the booking's existing duration. Deliberately no
  // availability or duration re-validation (B7 spec).
  const currentTagIds = (booking.booking_service_tags ?? [])
    .map(t => t.tag_id)
    .filter((id): id is string => id !== null);
  const nextTagIds: string[] = wantsTags ? (body.tag_ids as string[]) : currentTagIds;

  let tagDetails: Array<{ id: string; name: string; extra_price: number | null }> = [];
  if (nextTagIds.length > 0) {
    const { data: tags } = await supabase
      .from('service_tags')
      .select('id, name, extra_price')
      .in('id', nextTagIds)
      .eq('tenant_id', user.tenantId);
    tagDetails = tags ?? [];
    if (tagDetails.length !== new Set(nextTagIds).size) {
      return NextResponse.json({ error: 'Unknown service tag' }, { status: 400 });
    }
  }

  const { data: settings } = await supabase
    .from('tenant_settings')
    .select('base_rate_per_30min, staff_payout_pct, agency_share_pct')
    .eq('tenant_id', user.tenantId)
    .single();

  const baseRate = Number(settings?.base_rate_per_30min ?? 0);
  const payoutPct = Number(settings?.staff_payout_pct ?? 70);
  const tagExtrasTotal = round2(
    tagDetails.reduce((sum, t) => sum + (Number(t.extra_price) || 0), 0)
  );
  const computedTotal = round2(baseRate * (booking.duration_minutes / 30) + tagExtrasTotal);
  const totalPrice = overridePrice ?? computedTotal;
  const staffPayout = round2(totalPrice * (payoutPct / 100));
  const agencyShare = round2(totalPrice - staffPayout);

  const nextNotes = wantsNotes
    ? stripHtml(String(body.booking_notes)).slice(0, 1000) || null
    : booking.booking_notes;

  // Audit diff — only fields that actually changed.
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const oldTagNames = (booking.booking_service_tags ?? []).map(t => t.tag_name).sort();
  const newTagNames = tagDetails.map(t => t.name).sort();
  if (JSON.stringify(oldTagNames) !== JSON.stringify(newTagNames)) {
    changes.services = { from: oldTagNames, to: newTagNames };
  }
  if ((booking.booking_notes ?? null) !== nextNotes) {
    changes.booking_notes = { from: booking.booking_notes ?? null, to: nextNotes };
  }
  const oldPrice = booking.total_price === null ? null : round2(Number(booking.total_price));
  if (oldPrice !== totalPrice) {
    changes.total_price = { from: oldPrice, to: totalPrice };
  }

  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ ok: true, unchanged: true, total_price: totalPrice });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      booking_notes: nextNotes,
      tag_extras_total: tagExtrasTotal,
      total_price: totalPrice,
      staff_payout: staffPayout,
      agency_share: agencyShare,
      edited_at: now,
    })
    .eq('id', booking.id)
    .eq('tenant_id', user.tenantId);

  if (updateError) {
    console.error('[booking:edit] update error:', updateError);
    return NextResponse.json({ error: 'Failed to save changes' }, { status: 500 });
  }

  if (wantsTags && 'services' in changes) {
    await supabase.from('booking_service_tags').delete().eq('booking_id', booking.id);
    if (tagDetails.length > 0) {
      await supabase.from('booking_service_tags').insert(
        tagDetails.map(t => ({
          tenant_id: user.tenantId,
          booking_id: booking.id,
          tag_id: t.id,
          tag_name: t.name,
          extra_price: t.extra_price ?? 0,
        }))
      );
    }
  }

  const { error: auditError } = await supabase.from('booking_edits').insert({
    booking_id: booking.id,
    tenant_id: user.tenantId,
    edited_by_role: user.role,
    edited_by_id: user.role === 'staff' ? user.staffId ?? null : null,
    edited_at: now,
    changes,
  });
  if (auditError) {
    // The edit itself succeeded; surface the audit failure in logs only.
    console.error('[booking:edit] audit insert error:', auditError);
  }

  return NextResponse.json({ ok: true, total_price: totalPrice, changes });
}
