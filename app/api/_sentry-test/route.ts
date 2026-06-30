import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const key = process.env.SUPER_ADMIN_API_KEY;

  if (!key || secret !== key) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  throw new Error('Sentry test error — this is intentional');
}
