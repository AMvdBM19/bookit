import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import type { DefaultSettings, SeedTag } from '@/lib/types/tenant-config';

// DB defaults for tenant_settings fields the template can seed. A field is only
// overwritten by the template when it is still at this default — i.e. the super
// admin did not explicitly set it during tenant creation.
const SETTINGS_DB_DEFAULTS: Record<string, string | number> = {
  booking_confirm_mode: 'staff_must_accept',
  client_approval_mode: 'manual',
  default_slot_minutes: 30,
  deposit_pct: 20,
  deposit_required_above_minutes: 60,
};

function atDefault(current: unknown, dbDefault: string | number): boolean {
  if (current === null || current === undefined) return true;
  if (typeof dbDefault === 'number') return Number(current) === dbDefault;
  return current === dbDefault;
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const templateSlug: string | undefined = body?.template_slug?.trim();
  if (!templateSlug) {
    return NextResponse.json({ error: 'template_slug required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const tenantId = user.tenantId;

  // 1. Validate template exists and is active.
  const { data: template, error: tErr } = await supabase
    .from('industry_templates')
    .select('*')
    .eq('slug', templateSlug)
    .eq('is_active', true)
    .maybeSingle();

  if (tErr) {
    console.error('[select-template] template fetch error:', tErr);
    return NextResponse.json({ error: 'Failed to load template' }, { status: 500 });
  }
  if (!template) {
    return NextResponse.json({ error: 'Invalid or inactive template' }, { status: 400 });
  }

  // 2. Upsert tenant_config from the template.
  const { data: config, error: cfgErr } = await supabase
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
    )
    .select('*')
    .single();

  if (cfgErr || !config) {
    console.error('[select-template] tenant_config upsert error:', cfgErr);
    return NextResponse.json({ error: 'Failed to stamp tenant config' }, { status: 500 });
  }

  // 3. Apply default_settings to tenant_settings — only fields still at their
  //    DB defaults (don't clobber values the super admin set at creation).
  const ds = template.default_settings as DefaultSettings;

  const { data: currentSettings } = await supabase
    .from('tenant_settings')
    .select('booking_confirm_mode, client_approval_mode, default_slot_minutes, deposit_pct, deposit_required_above_minutes')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const settingsUpdate: Record<string, unknown> = {};
  const candidates: Record<string, string | number> = {
    booking_confirm_mode: ds.booking_confirm_mode,
    client_approval_mode: ds.client_approval_mode,
    default_slot_minutes: ds.default_slot_minutes,
    deposit_pct: ds.deposit_pct,
    deposit_required_above_minutes: ds.deposit_required_above_minutes,
  };

  for (const [field, templateValue] of Object.entries(candidates)) {
    const current = currentSettings ? (currentSettings as Record<string, unknown>)[field] : undefined;
    if (atDefault(current, SETTINGS_DB_DEFAULTS[field])) {
      settingsUpdate[field] = templateValue;
    }
  }

  if (Object.keys(settingsUpdate).length > 0) {
    settingsUpdate.updated_at = new Date().toISOString();
    if (currentSettings) {
      await supabase.from('tenant_settings').update(settingsUpdate).eq('tenant_id', tenantId);
    } else {
      await supabase.from('tenant_settings').upsert({ tenant_id: tenantId, ...settingsUpdate });
    }
  }

  // client_mode lives on tenants — only set it if still at the DB default.
  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('client_mode')
    .eq('id', tenantId)
    .maybeSingle();

  const tenantUpdate: Record<string, unknown> = { vertical: template.slug };
  if (tenantRow && tenantRow.client_mode === 'account') {
    tenantUpdate.client_mode = ds.client_mode;
  }

  // 4. Seed service_tags only if the tenant has none.
  const seedTags = (template.seed_tags as SeedTag[]) ?? [];
  if (seedTags.length > 0) {
    const { count } = await supabase
      .from('service_tags')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    if (!count) {
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

  // 5. Update tenants.vertical (+ client_mode if defaulted).
  const { error: tenantErr } = await supabase
    .from('tenants')
    .update(tenantUpdate)
    .eq('id', tenantId);

  if (tenantErr) {
    console.error('[select-template] tenant update error:', tenantErr);
    return NextResponse.json({ error: 'Failed to update tenant' }, { status: 500 });
  }

  // 6. Return the stamped config.
  return NextResponse.json({ config });
}
