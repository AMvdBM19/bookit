import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

// GET — all service tags for the tenant (agent-only). Used by the Pricing tab's
// per-service pricing table.
export async function GET() {
  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // select('*') keeps this resilient to additive columns (duration_minutes)
  // that may not exist until migrations run.
  const { data: tags, error } = await supabase
    .from('service_tags')
    .select('*')
    .eq('tenant_id', user.tenantId)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[tags:list] error:', error);
    return NextResponse.json({ error: 'Failed to load tags' }, { status: 500 });
  }

  return NextResponse.json({ tags: tags ?? [] });
}

// POST — create a new service tag (agent-only). Tenants own their tags;
// after onboarding this is the only way to add one.
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 80) {
    return NextResponse.json({ error: 'Name is required (max 80 characters)' }, { status: 400 });
  }
  const description =
    typeof body?.description === 'string' && body.description.trim()
      ? body.description.trim().slice(0, 300)
      : null;

  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from('service_tags')
    .select('id, name, display_order')
    .eq('tenant_id', user.tenantId);

  if ((existing ?? []).some(t => t.name.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json({ error: 'A service with this name already exists' }, { status: 409 });
  }

  const nextOrder = Math.max(0, ...(existing ?? []).map(t => t.display_order ?? 0)) + 1;

  const { data: tag, error } = await supabase
    .from('service_tags')
    .insert({
      tenant_id: user.tenantId,
      name,
      description,
      extra_price: 0,
      display_order: nextOrder,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[tags:create] error:', error);
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 });
  }

  return NextResponse.json({ tag }, { status: 201 });
}
