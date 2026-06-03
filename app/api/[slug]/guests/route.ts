import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

export async function GET() {
  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: guests, error } = await supabase
    .from('guest_clients')
    .select('id, name, email, phone, booking_count, last_seen_at, created_at, wa_opt_in')
    .eq('tenant_id', user.tenantId)
    .order('last_seen_at', { ascending: false });

  if (error) {
    console.error('[guests:list] error:', error);
    return NextResponse.json({ error: 'Failed to load guests' }, { status: 500 });
  }

  // Fetch active blocks to mark blocked guests
  const { data: blocks } = await supabase
    .from('guest_blocks')
    .select('email')
    .eq('tenant_id', user.tenantId);

  const blockedEmails = new Set((blocks ?? []).map(b => b.email).filter(Boolean));

  const enriched = (guests ?? []).map(g => ({
    ...g,
    is_blocked: g.email ? blockedEmails.has(g.email) : false,
  }));

  return NextResponse.json({ guests: enriched });
}
