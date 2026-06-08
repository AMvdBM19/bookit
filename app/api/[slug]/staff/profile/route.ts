import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  await params;

  let user;
  try {
    user = await requireRole(['staff']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!user.staffId) {
    return NextResponse.json({ error: 'No staff record' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.pseudonym === 'string' && body.pseudonym.trim()) {
    updates.pseudonym = body.pseudonym.trim().slice(0, 100);
  }
  if ('bio' in body) {
    updates.bio = typeof body.bio === 'string' ? body.bio.trim().slice(0, 1000) || null : null;
  }
  if (Array.isArray(body.languages)) {
    updates.languages = body.languages.filter((l: unknown) => typeof l === 'string' && l.trim()).slice(0, 10);
  }
  if ('gender' in body) {
    updates.gender = typeof body.gender === 'string' ? body.gender.trim().slice(0, 50) || null : null;
  }
  if ('nationality' in body) {
    updates.nationality = typeof body.nationality === 'string' ? body.nationality.trim().slice(0, 50) || null : null;
  }
  if ('age' in body) {
    const age = Number(body.age);
    updates.age = !isNaN(age) && age >= 18 ? age : null;
  }
  if (typeof body.social_links === 'object' && body.social_links !== null) {
    const allowed = ['instagram', 'tiktok', 'facebook', 'x', 'website'];
    const links: Record<string, string> = {};
    for (const key of allowed) {
      if (typeof body.social_links[key] === 'string') {
        links[key] = body.social_links[key].trim().slice(0, 500);
      }
    }
    updates.social_links = links;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from('staff')
    .update(updates)
    .eq('id', user.staffId)
    .eq('tenant_id', user.tenantId);

  if (error) {
    console.error('[staff:profile] update error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
