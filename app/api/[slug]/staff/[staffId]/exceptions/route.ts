import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import type { AuthenticatedUser } from '@/lib/types/auth';

// Staff exceptions (days off). Agents manage any staff member's exceptions;
// staff manage only their own.

async function authorize(staffId: string): Promise<AuthenticatedUser | NextResponse> {
  let user: AuthenticatedUser;
  try {
    user = await requireRole(['agent', 'staff']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.role === 'staff' && user.staffId !== staffId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return user;
}

// GET — upcoming exceptions for a staff member.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; staffId: string }> }
) {
  const { staffId } = await params;
  const auth = await authorize(staffId);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: exceptions, error } = await supabase
    .from('staff_exceptions')
    .select('id, exception_date, reason, created_by, created_at')
    .eq('tenant_id', auth.tenantId)
    .eq('staff_id', staffId)
    .gte('exception_date', today)
    .order('exception_date', { ascending: true });

  if (error) {
    console.error('[exceptions:list] error:', error);
    return NextResponse.json({ error: 'Failed to load exceptions' }, { status: 500 });
  }

  return NextResponse.json({ exceptions: exceptions ?? [] });
}

// POST — add a day off. Body: { exception_date: 'YYYY-MM-DD', reason?: string }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; staffId: string }> }
) {
  const { staffId } = await params;
  const auth = await authorize(staffId);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const exceptionDate = body?.exception_date as string | undefined;
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';

  if (!exceptionDate || !/^\d{4}-\d{2}-\d{2}$/.test(exceptionDate)) {
    return NextResponse.json({ error: 'exception_date (YYYY-MM-DD) is required' }, { status: 400 });
  }

  const today = new Date().toISOString().split('T')[0];
  if (exceptionDate < today) {
    return NextResponse.json({ error: 'Date cannot be in the past' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify the staff member belongs to this tenant.
  const { data: staff } = await supabase
    .from('staff')
    .select('id')
    .eq('id', staffId)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();

  if (!staff) {
    return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from('staff_exceptions')
    .select('id')
    .eq('tenant_id', auth.tenantId)
    .eq('staff_id', staffId)
    .eq('exception_date', exceptionDate)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'This date is already marked as a day off' }, { status: 409 });
  }

  const { data: created, error } = await supabase
    .from('staff_exceptions')
    .insert({
      tenant_id: auth.tenantId,
      staff_id: staffId,
      exception_date: exceptionDate,
      reason: reason || null,
      created_by: auth.role === 'agent' ? 'agent' : 'staff',
    })
    .select('id, exception_date, reason, created_by, created_at')
    .single();

  if (error || !created) {
    console.error('[exceptions:create] error:', error);
    return NextResponse.json({ error: 'Failed to add exception' }, { status: 500 });
  }

  return NextResponse.json({ exception: created });
}
