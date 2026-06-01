import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const staffId = body?.staffId;

  if (!staffId) {
    return NextResponse.json({ error: 'staffId required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('staff')
    .update({ first_login: false, wizard_completed: true })
    .eq('id', staffId);

  if (error) {
    return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
