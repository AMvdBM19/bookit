import { NextResponse } from 'next/server';
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

  const { data: tags, error } = await supabase
    .from('service_tags')
    .select('id, name, description, extra_price, is_active, display_order')
    .eq('tenant_id', user.tenantId)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[tags:list] error:', error);
    return NextResponse.json({ error: 'Failed to load tags' }, { status: 500 });
  }

  return NextResponse.json({ tags: tags ?? [] });
}
