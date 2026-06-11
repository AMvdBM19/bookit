import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// POST — reserved AI assistant endpoint (agent-only).
// Gated on tenant_settings.ai_assistant_enabled; returns 501 until a
// provider adapter is implemented (see lib/ai/README.md).
export async function POST() {
  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: settings, error } = await supabase
    .from('tenant_settings')
    .select('ai_assistant_enabled, ai_provider')
    .eq('tenant_id', user.tenantId)
    .maybeSingle();

  if (error) {
    console.error('[assistant] settings query error:', error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }

  if (!settings?.ai_assistant_enabled) {
    return NextResponse.json(
      { error: 'AI assistant is not enabled for this tenant' },
      { status: 403 }
    );
  }

  return NextResponse.json(
    { error: 'AI assistant is not yet implemented', provider: settings.ai_provider },
    { status: 501 }
  );
}
