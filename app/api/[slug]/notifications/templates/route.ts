import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

const ALLOWED_EVENT_TYPES = [
  'booking_confirmed',
  'booking_declined',
  'booking_reminder',
  'booking_cancelled',
  'client_approved',
] as const;

const ALLOWED_CHANNELS = ['whatsapp', 'email'] as const;

// [services] is filled on the email channel only (the dispatch loads the
// booking's service tags itself); on WhatsApp it stays as typed.
const TEMPLATE_VARIABLES: Record<string, string[]> = {
  booking_confirmed: ['client_name', 'staff_name', 'date', 'time', 'duration', 'services', 'agency_name'],
  booking_declined: ['client_name', 'staff_name', 'date', 'time', 'agency_name'],
  booking_reminder: ['client_name', 'staff_name', 'date', 'time'],
  booking_cancelled: ['client_name', 'staff_name', 'date', 'agency_name'],
  client_approved: ['client_name', 'agency_name'],
};

export async function GET() {
  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('notification_templates')
    .select('id, event_type, channel, subject, body, is_active, updated_at')
    .eq('tenant_id', user.tenantId)
    .order('event_type', { ascending: true })
    .order('channel', { ascending: true });

  if (error) {
    console.error('[templates:list] error:', error);
    return NextResponse.json({ error: 'Failed to load templates' }, { status: 500 });
  }

  return NextResponse.json({
    templates: data ?? [],
    variables: TEMPLATE_VARIABLES,
    eventTypes: ALLOWED_EVENT_TYPES,
    channels: ALLOWED_CHANNELS,
  });
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const eventType = body?.event_type;
  const channel = body?.channel;
  const templateBody: string | undefined = body?.body;
  const subject: string | null = body?.subject ?? null;

  if (!eventType || !ALLOWED_EVENT_TYPES.includes(eventType)) {
    return NextResponse.json(
      { error: `event_type must be one of: ${ALLOWED_EVENT_TYPES.join(', ')}` },
      { status: 400 }
    );
  }
  if (!channel || !ALLOWED_CHANNELS.includes(channel)) {
    return NextResponse.json(
      { error: `channel must be one of: ${ALLOWED_CHANNELS.join(', ')}` },
      { status: 400 }
    );
  }
  if (!templateBody || !templateBody.trim()) {
    return NextResponse.json({ error: 'body is required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from('notification_templates')
    .upsert(
      {
        tenant_id: user.tenantId,
        event_type: eventType,
        channel,
        subject: channel === 'email' ? subject : null,
        body: templateBody,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,event_type,channel' }
    );

  if (error) {
    console.error('[templates:upsert] error:', error);
    return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
