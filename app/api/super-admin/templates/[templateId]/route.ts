import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validateSuperAdminKey } from '@/lib/auth/super-admin';
import {
  validateTerminology,
  validateFeatureFlags,
  validateComplianceFlags,
  validateDefaultSettings,
  validateSeedTags,
} from '@/lib/templates/validation';

// Slug is intentionally excluded — it is immutable.
const SCALAR_FIELDS = ['label', 'icon', 'description', 'is_active', 'sort_order'] as const;

// PATCH — update a template. Slug cannot change.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  if (!validateSuperAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { templateId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  for (const field of SCALAR_FIELDS) {
    if (field in body) update[field] = body[field];
  }

  // JSONB fields — validate when present.
  const jsonbValidators: Record<string, (v: unknown) => string | null> = {
    terminology: validateTerminology,
    feature_flags: validateFeatureFlags,
    compliance_flags: validateComplianceFlags,
    default_settings: validateDefaultSettings,
    seed_tags: validateSeedTags,
  };

  for (const [field, validate] of Object.entries(jsonbValidators)) {
    if (field in body) {
      const err = validate(body[field]);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      update[field] = body[field];
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No allowed fields provided' }, { status: 400 });
  }

  update.updated_at = new Date().toISOString();

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('industry_templates')
    .update(update)
    .eq('id', templateId);

  if (error) {
    console.error('[super-admin:templates:patch] error:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE — soft-delete (is_active = false). System templates cannot be deleted.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  if (!validateSuperAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { templateId } = await params;
  const supabase = createServiceClient();

  const { data: template, error: fetchError } = await supabase
    .from('industry_templates')
    .select('id, is_system')
    .eq('id', templateId)
    .maybeSingle();

  if (fetchError) {
    console.error('[super-admin:templates:delete] fetch error:', fetchError);
    return NextResponse.json({ error: 'Failed to load template' }, { status: 500 });
  }
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }
  if (template.is_system) {
    return NextResponse.json(
      { error: 'Cannot delete system templates. Deactivate instead.' },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('industry_templates')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', templateId);

  if (error) {
    console.error('[super-admin:templates:delete] error:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
