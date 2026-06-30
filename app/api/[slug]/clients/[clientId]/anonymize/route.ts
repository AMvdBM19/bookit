import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
import { anonymizeClient } from '@/lib/gdpr/anonymize';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string; clientId: string }> }
) {
  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { clientId } = await params;
  const supabase = createServiceClient();

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('tenant_id', user.tenantId)
    .maybeSingle();

  const { data: guest } = await supabase
    .from('guest_clients')
    .select('id')
    .eq('id', clientId)
    .eq('tenant_id', user.tenantId)
    .maybeSingle();

  if (!client && !guest) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const clientType = client ? 'client' : 'guest_client';
  const result = await anonymizeClient(supabase, user.tenantId, clientId, clientType as 'client' | 'guest_client');

  if (!result.success) {
    return NextResponse.json({ error: 'Anonymization failed' }, { status: 500 });
  }

  if (result.alreadyAnonymized) {
    return NextResponse.json({ ok: true, message: 'Already anonymized' });
  }

  return NextResponse.json({
    ok: true,
    bookingsAnonymized: result.bookingsAnonymized,
  });
}
