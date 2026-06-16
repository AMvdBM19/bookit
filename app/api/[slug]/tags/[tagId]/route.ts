import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

const ALLOWED_FIELDS = ['extra_price', 'is_active', 'name', 'description', 'display_order', 'duration_minutes', 'blocks_slot', 'allow_quantity', 'max_quantity'] as const;

// PATCH — update a service tag's pricing/status (agent-only, tenant-scoped).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; tagId: string }> }
) {
  const { tagId } = await params;

  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  if ('extra_price' in updates) {
    const price = Number(updates.extra_price);
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: 'extra_price must be a non-negative number' }, { status: 400 });
    }
    updates.extra_price = price;
  }

  if ('duration_minutes' in updates && updates.duration_minutes !== null) {
    const minutes = Number(updates.duration_minutes);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 600) {
      return NextResponse.json(
        { error: 'duration_minutes must be an integer between 5 and 600, or null' },
        { status: 400 }
      );
    }
    updates.duration_minutes = minutes;
  }

  if ('blocks_slot' in updates) updates.blocks_slot = Boolean(updates.blocks_slot);
  if ('allow_quantity' in updates) updates.allow_quantity = Boolean(updates.allow_quantity);
  if ('max_quantity' in updates) {
    const max = Number(updates.max_quantity);
    if (!Number.isInteger(max) || max < 1 || max > 20) {
      return NextResponse.json(
        { error: 'max_quantity must be an integer between 1 and 20' },
        { status: 400 }
      );
    }
    updates.max_quantity = max;
  }

  if ('description' in updates) {
    updates.description =
      typeof updates.description === 'string' && updates.description.trim()
        ? updates.description.trim().slice(0, 100)
        : null;
  }

  const supabase = createServiceClient();

  // Verify tenant ownership before updating.
  const { data: existing } = await supabase
    .from('service_tags')
    .select('id, tenant_id')
    .eq('id', tagId)
    .single();

  if (!existing || existing.tenant_id !== user.tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('service_tags')
    .update(updates)
    .eq('id', tagId)
    .eq('tenant_id', user.tenantId);

  if (error) {
    console.error('[tags:patch] error:', error);
    return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE — remove a service tag (agent-only, tenant-scoped). Tags referenced
// by booking history are protected by FK and should be deactivated instead.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; tagId: string }> }
) {
  const { tagId } = await params;

  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from('service_tags')
    .select('id, tenant_id')
    .eq('id', tagId)
    .single();

  if (!existing || existing.tenant_id !== user.tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('service_tags')
    .delete()
    .eq('id', tagId)
    .eq('tenant_id', user.tenantId);

  if (error) {
    // 23503 = foreign_key_violation: tag is referenced by past bookings.
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'This service has booking history and cannot be deleted. Deactivate it instead.' },
        { status: 409 }
      );
    }
    console.error('[tags:delete] error:', error);
    return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
