import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ts = new Date().toISOString();
  let dbOk = false;

  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from('tenants')
      .select('id')
      .limit(1)
      .abortSignal(AbortSignal.timeout(3000));

    dbOk = !error;
  } catch {
    dbOk = false;
  }

  if (!dbOk) {
    return NextResponse.json({ ok: false, ts, db: false }, { status: 503 });
  }

  return NextResponse.json({ ok: true, ts, db: true });
}
