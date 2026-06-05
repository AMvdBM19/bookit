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

const SLUG_RE = /^[a-z][a-z0-9_]*$/;

// GET — all templates with a tenant_count derived from tenant_config.
export async function GET(request: NextRequest) {
  if (!validateSuperAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: templates, error } = await supabase
    .from('industry_templates')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[super-admin:templates:list] error:', error);
    return NextResponse.json({ error: 'Failed to load templates' }, { status: 500 });
  }

  const enriched = await Promise.all(
    (templates ?? []).map(async t => {
      const { count } = await supabase
        .from('tenant_config')
        .select('tenant_id', { count: 'exact', head: true })
        .eq('source_template_slug', t.slug);
      return { ...t, tenant_count: count ?? 0 };
    })
  );

  return NextResponse.json({ templates: enriched });
}

// POST — create a user-defined template (is_system = false).
export async function POST(request: NextRequest) {
  if (!validateSuperAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const slug: string | undefined = body.slug?.trim()?.toLowerCase();
  const label: string | undefined = body.label?.trim();

  if (!slug || !SLUG_RE.test(slug)) {
    return NextResponse.json(
      { error: 'slug required: must start with a letter, lowercase, letters/digits/underscores only' },
      { status: 400 }
    );
  }
  if (!label) {
    return NextResponse.json({ error: 'label is required' }, { status: 400 });
  }

  const errors = [
    validateTerminology(body.terminology),
    validateFeatureFlags(body.feature_flags),
    validateComplianceFlags(body.compliance_flags),
    validateDefaultSettings(body.default_settings),
    validateSeedTags(body.seed_tags),
  ].filter(Boolean);

  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0] }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from('industry_templates')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
  }

  const { data: template, error } = await supabase
    .from('industry_templates')
    .insert({
      slug,
      label,
      description: body.description ?? null,
      icon: body.icon ?? '🏢',
      terminology: body.terminology,
      feature_flags: body.feature_flags,
      compliance_flags: body.compliance_flags,
      default_settings: body.default_settings,
      seed_tags: body.seed_tags,
      is_system: false,
      is_active: true,
      sort_order: typeof body.sort_order === 'number' ? body.sort_order : 0,
    })
    .select('*')
    .single();

  if (error || !template) {
    console.error('[super-admin:templates:create] error:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }

  return NextResponse.json({ template }, { status: 201 });
}
