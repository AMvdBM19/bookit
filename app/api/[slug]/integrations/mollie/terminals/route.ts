import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

// Phase 18-A1: POS terminal device registration (agent-only). A tenant's
// physical Mollie PIN terminals, used by the "Charge to terminal" flow. The
// terminal_id (term_xxx) is masked on GET, like the Mollie API key elsewhere.

function maskTerminalId(id: string | null | undefined): string | null {
  if (!id) return null;
  const prefixMatch = id.match(/^term_/);
  const prefix = prefixMatch ? 'term_' : '';
  const body = prefix ? id.slice(prefix.length) : id;
  const tail = body.slice(-4);
  return `${prefix}${'•'.repeat(6)}${tail}`;
}

async function auth() {
  return requireRole(['agent']);
}

// GET — list registered terminals (terminal_id masked).
export async function GET() {
  let user;
  try {
    user = await auth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('terminal_devices')
    .select('id, device_name, terminal_id, is_active, created_at')
    .eq('tenant_id', user.tenantId)
    .order('created_at', { ascending: true });

  if (error) {
    // Table missing until the migration is applied — surface a clear, non-fatal
    // message rather than a 500 so the UI can explain it.
    console.error('[integrations:mollie:terminals:list] error:', error.message);
    return NextResponse.json({ terminals: [], error: 'Terminals unavailable' }, { status: 200 });
  }

  const terminals = (data ?? []).map(t => ({
    id: t.id,
    device_name: t.device_name,
    masked_terminal_id: maskTerminalId(t.terminal_id),
    is_active: t.is_active,
    created_at: t.created_at,
  }));

  return NextResponse.json({ terminals });
}

// POST — register a terminal. Body: { device_name?, terminal_id }.
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await auth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const terminalId = typeof body.terminal_id === 'string' ? body.terminal_id.trim() : '';
  if (!terminalId) {
    return NextResponse.json({ error: 'A terminal ID is required' }, { status: 400 });
  }
  if (!/^term_[A-Za-z0-9]{6,}$/.test(terminalId)) {
    return NextResponse.json(
      { error: 'Terminal ID must look like term_xxxxxxxx (from your Mollie dashboard)' },
      { status: 400 }
    );
  }

  const deviceName =
    typeof body.device_name === 'string' && body.device_name.trim() !== ''
      ? body.device_name.trim().slice(0, 80)
      : 'PIN terminal';

  const supabase = createServiceClient();
  const { error } = await supabase.from('terminal_devices').insert({
    tenant_id: user.tenantId,
    device_name: deviceName,
    terminal_id: terminalId,
    is_active: true,
  });

  if (error) {
    console.error('[integrations:mollie:terminals:create] error:', error.message);
    return NextResponse.json({ error: 'Failed to register terminal' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE — remove a terminal by id (?id=uuid).
export async function DELETE(request: NextRequest) {
  let user;
  try {
    user = await auth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'A terminal id is required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('terminal_devices')
    .delete()
    .eq('id', id)
    .eq('tenant_id', user.tenantId);

  if (error) {
    console.error('[integrations:mollie:terminals:delete] error:', error.message);
    return NextResponse.json({ error: 'Failed to remove terminal' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
