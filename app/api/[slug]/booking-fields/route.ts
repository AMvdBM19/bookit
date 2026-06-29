import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// Phase 20-C3: tenant-defined booking form fields (the "Booking form" builder).
// Agent-only CRUD. Legacy keys service_address / reference_image are migrated
// here (Phase 20-C2) and map to dedicated booking columns in the book route;
// their field_key and field_type are immutable.

const FIELD_TYPES = ['text', 'textarea', 'date', 'address', 'radio', 'checkbox', 'select', 'file'] as const;
type FieldType = (typeof FIELD_TYPES)[number];
const OPTION_TYPES: FieldType[] = ['radio', 'checkbox', 'select'];
const RESERVED_KEYS = ['service_address', 'reference_image'];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

function sanitizeOptions(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const opts = raw
    .map(o => (typeof o === 'string' ? o : typeof o === 'object' && o ? String((o as { label?: unknown }).label ?? '') : ''))
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 30);
  return opts.length > 0 ? opts : null;
}

async function auth(): Promise<{ tenantId: string } | NextResponse> {
  try {
    const user = await requireRole(['agent']);
    return { tenantId: user.tenantId };
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function GET() {
  const a = await auth();
  if (a instanceof NextResponse) return a;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('booking_fields')
    .select('id, field_key, label, field_type, placeholder, help_text, required, options, display_order, is_active')
    .eq('tenant_id', a.tenantId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[booking-fields:list] error:', error);
    return NextResponse.json({ error: 'Failed to load fields' }, { status: 500 });
  }
  return NextResponse.json({ fields: data ?? [], reserved_keys: RESERVED_KEYS });
}

export async function POST(request: NextRequest) {
  const a = await auth();
  if (a instanceof NextResponse) return a;

  const body = await request.json().catch(() => null);
  const label: string = typeof body?.label === 'string' ? body.label.trim() : '';
  const fieldType: string = body?.field_type;

  if (!label) return NextResponse.json({ error: 'Label is required' }, { status: 400 });
  if (!FIELD_TYPES.includes(fieldType as FieldType)) {
    return NextResponse.json({ error: 'Invalid field type' }, { status: 400 });
  }

  let options: string[] | null = null;
  if (OPTION_TYPES.includes(fieldType as FieldType)) {
    options = sanitizeOptions(body?.options);
    if (!options) {
      return NextResponse.json({ error: 'This field type needs at least one option' }, { status: 400 });
    }
  }

  const supabase = createServiceClient();

  // Generate a unique field_key from the label (reserved keys are off-limits).
  const base = slugify(label) || 'field';
  const { data: existing } = await supabase
    .from('booking_fields')
    .select('field_key')
    .eq('tenant_id', a.tenantId);
  const taken = new Set([...(existing ?? []).map(f => f.field_key as string), ...RESERVED_KEYS]);
  let key = base;
  let n = 2;
  while (taken.has(key)) {
    key = `${base}_${n++}`;
  }

  // Append to the end of the order.
  const { data: maxRow } = await supabase
    .from('booking_fields')
    .select('display_order')
    .eq('tenant_id', a.tenantId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.display_order ?? -1) + 1;

  const { data: inserted, error } = await supabase
    .from('booking_fields')
    .insert({
      tenant_id: a.tenantId,
      field_key: key,
      label: label.slice(0, 120),
      field_type: fieldType,
      placeholder: typeof body?.placeholder === 'string' ? body.placeholder.slice(0, 200) || null : null,
      help_text: typeof body?.help_text === 'string' ? body.help_text.slice(0, 300) || null : null,
      required: !!body?.required,
      options,
      display_order: nextOrder,
      is_active: true,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[booking-fields:create] error:', error);
    return NextResponse.json({ error: 'Failed to create field' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: inserted?.id });
}

export async function PATCH(request: NextRequest) {
  const a = await auth();
  if (a instanceof NextResponse) return a;

  const body = await request.json().catch(() => null);
  const id: string = body?.id;
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const supabase = createServiceClient();
  const { data: field } = await supabase
    .from('booking_fields')
    .select('id, tenant_id, field_type')
    .eq('id', id)
    .eq('tenant_id', a.tenantId)
    .maybeSingle();
  if (!field) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (typeof body.label === 'string' && body.label.trim()) update.label = body.label.trim().slice(0, 120);
  if (typeof body.placeholder === 'string') update.placeholder = body.placeholder.slice(0, 200) || null;
  if (typeof body.help_text === 'string') update.help_text = body.help_text.slice(0, 300) || null;
  if (typeof body.required === 'boolean') update.required = body.required;
  if (typeof body.is_active === 'boolean') update.is_active = body.is_active;
  if (Number.isFinite(body.display_order)) update.display_order = Math.max(0, Math.floor(body.display_order));
  if (OPTION_TYPES.includes(field.field_type as FieldType) && body.options !== undefined) {
    const opts = sanitizeOptions(body.options);
    if (!opts) return NextResponse.json({ error: 'At least one option is required' }, { status: 400 });
    update.options = opts;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 });
  }

  const { error } = await supabase
    .from('booking_fields')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', a.tenantId);

  if (error) {
    console.error('[booking-fields:update] error:', error);
    return NextResponse.json({ error: 'Failed to update field' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const a = await auth();
  if (a instanceof NextResponse) return a;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('booking_fields')
    .delete()
    .eq('id', id)
    .eq('tenant_id', a.tenantId);

  if (error) {
    console.error('[booking-fields:delete] error:', error);
    return NextResponse.json({ error: 'Failed to delete field' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
