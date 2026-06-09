import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

interface SearchResult {
  id: string;
  type: 'client' | 'guest';
  name: string;
  email: string;
  phone: string | null;
}

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Sanitize the term — strip characters that would break the PostgREST `or` filter.
  const raw = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  const q = raw.replace(/[,()*%]/g, '');
  if (q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  const supabase = createServiceClient();
  const pattern = `%${q}%`;

  const [{ data: clients }, { data: guests }] = await Promise.all([
    supabase
      .from('clients')
      .select('id, display_name, email, phone')
      .eq('tenant_id', user.tenantId)
      .or(`display_name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(10),
    supabase
      .from('guest_clients')
      .select('id, name, email, phone')
      .eq('tenant_id', user.tenantId)
      .or(`name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(10),
  ]);

  const results: SearchResult[] = [
    ...(clients ?? []).map(c => ({
      id: c.id,
      type: 'client' as const,
      name: c.display_name,
      email: c.email,
      phone: c.phone,
    })),
    ...(guests ?? []).map(g => ({
      id: g.id,
      type: 'guest' as const,
      name: g.name,
      email: g.email,
      phone: g.phone,
    })),
  ].slice(0, 10);

  return NextResponse.json({ results });
}
