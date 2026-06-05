import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validateSuperAdminKey } from '@/lib/auth/super-admin';
import type { DefaultSettings, SeedTag } from '@/lib/types/tenant-config';

// POST — hard-reset a tenant's config to a template. Optionally reset settings
// and/or service tags too. Locked settings fields are preserved.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  if (!validateSuperAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tenantId } = await params;
  const body = await request.json().catch(() => null);
  const templateSlug: string | undefined = body?.template_slug?.trim();
  if (!templateSlug) {
    return NextResponse.json({ error: 'template_slug required' }, { status: 400 });
  }
  const resetSettings = body?.reset_settings === true;
  const resetTags = body?.reset_tags === true;

  const supabase = createServiceClient();

  // 1. Validate template.
  const { data: template, error: tErr } = await supabase
    .from('industry_templates')
    .select('*')
    .eq('slug', templateSlug)
    .maybeSingle();

  if (tErr) {
    console.error('[reset-config] template fetch error:', tErr);
    return NextResponse.json({ error: 'Failed to load template' }, { status: 500 });
  }
  if (!template) {
    return NextResponse.json({ error: 'Invalid template' }, { status: 400 });
  }

  // 2. Overwrite tenant_config.
  const { error: cfgErr } = await supabase
    .from('tenant_config')
    .upsert(
      {
        tenant_id: tenantId,
        source_template_slug: template.slug,
        terminology: template.terminology,
        feature_flags: template.feature_flags,
        compliance_flags: template.compliance_flags,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id' }
    );

  if (cfgErr) {
    console.error('[reset-config] tenant_config upsert error:', cfgErr);
    return NextResponse.json({ error: 'Failed to reset config' }, { status: 500 });
  }

  // 3. Optionally overwrite tenant_settings, skipping locked fields.
  if (resetSettings) {
    const ds = template.default_settings as DefaultSettings;

    const { data: lockedRows } = await supabase
      .from('tenant_locked_settings')
      .select('field_name')
      .eq('tenant_id', tenantId);
    const locked = new Set((lockedRows ?? []).map(r => r.field_name));

    const settingsUpdate: Record<string, unknown> = {};
    const candidates: Record<string, string | number> = {
      booking_confirm_mode: ds.booking_confirm_mode,
      client_approval_mode: ds.client_approval_mode,
      default_slot_minutes: ds.default_slot_minutes,
      deposit_pct: ds.deposit_pct,
      deposit_required_above_minutes: ds.deposit_required_above_minutes,
    };
    for (const [field, value] of Object.entries(candidates)) {
      if (!locked.has(field)) settingsUpdate[field] = value;
    }

    if (Object.keys(settingsUpdate).length > 0) {
      settingsUpdate.updated_at = new Date().toISOString();
      await supabase
        .from('tenant_settings')
        .upsert({ tenant_id: tenantId, ...settingsUpdate }, { onConflict: 'tenant_id' });
    }

    // client_mode lives on tenants — overwrite unless locked.
    if (!locked.has('client_mode')) {
      await supabase.from('tenants').update({ client_mode: ds.client_mode }).eq('id', tenantId);
    }
  }

  // 4. Optionally reset service_tags.
  if (resetTags) {
    await supabase.from('service_tags').delete().eq('tenant_id', tenantId);
    const seedTags = (template.seed_tags as SeedTag[]) ?? [];
    if (seedTags.length > 0) {
      const rows = seedTags.map((tag, i) => ({
        tenant_id: tenantId,
        name: tag.name,
        description: tag.description ?? null,
        extra_price: 0,
        display_order: i,
      }));
      await supabase.from('service_tags').insert(rows);
    }
  }

  // 5. Update tenants.vertical.
  const { error: tenantErr } = await supabase
    .from('tenants')
    .update({ vertical: template.slug })
    .eq('id', tenantId);

  if (tenantErr) {
    console.error('[reset-config] tenant vertical update error:', tenantErr);
    return NextResponse.json({ error: 'Failed to update tenant' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
