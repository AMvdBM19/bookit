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

  const { data, error } = await supabase
    .from('clients')
    .select('id, display_name, email, phone, status, status_reason, approved_at, created_at, wa_opt_in, anonymized_at')
    .eq('tenant_id', user.tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[clients:list] error:', error);
    return NextResponse.json({ error: 'Failed to load clients' }, { status: 500 });
  }

  return NextResponse.json({ clients: data ?? [] });
}
