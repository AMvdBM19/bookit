import { createServiceClient } from '@/lib/supabase/server';
import type { Terminology, FeatureFlags } from '@/lib/types/tenant-config';
import { DEFAULT_TERMINOLOGY, DEFAULT_FEATURE_FLAGS } from '@/lib/types/tenant-config';

export interface CatalogStaff {
  id: string;
  pseudonym: string;
  bio: string | null;
  photo_urls: string[] | null;
  social_links: Record<string, string> | null;
  gender: string | null;
  nationality: string | null;
  age: number | null;
  languages: string[] | null;
  tags: Array<{ id: string; name: string; extra_price: number }>;
}

export interface CatalogSettings {
  brand_color: string;
  agency_display_name: string | null;
  logo_url: string | null;
  show_price_to_client: boolean;
  base_rate_per_30min: number;
  age_gate_minimum: number;
  require_age_confirm: boolean;
  booking_confirm_mode: string;
  default_slot_minutes: number;
  min_lead_time_hours: number;
  currency: string;
  deposit_pct: number | null;
  deposit_required_above_minutes: number | null;
}

export interface Catalog {
  tenant: {
    id: string;
    name: string;
    vertical: string;
    client_mode: 'guest' | 'account';
  };
  settings: CatalogSettings | null;
  staff: CatalogStaff[];
  tags: Array<{ id: string; name: string; extra_price: number | null }>;
  terminology: Terminology;
  featureFlags: FeatureFlags;
}

export async function loadCatalog(slug: string): Promise<Catalog | null> {
  const supabase = createServiceClient();

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, name, vertical, client_mode, is_active')
    .eq('slug', slug)
    .single();

  if (tenantError) {
    console.error('[catalog] Tenant query error:', tenantError.message);
  }

  if (!tenant || !tenant.is_active) return null;

  const { data: settings, error: settingsError } = await supabase
    .from('tenant_settings')
    .select(
      'brand_color, agency_display_name, logo_url, show_price_to_client, base_rate_per_30min, age_gate_minimum, require_age_confirm, booking_confirm_mode, default_slot_minutes, min_lead_time_hours, currency, deposit_pct, deposit_required_above_minutes'
    )
    .eq('tenant_id', tenant.id)
    .single();

  if (settingsError) {
    console.error('[catalog] Settings query error:', settingsError.message);
  }

  const { data: staffRows, error: staffError } = await supabase
    .from('staff')
    .select('id, pseudonym, bio, photo_urls, social_links, gender, nationality, age, languages')
    .eq('tenant_id', tenant.id)
    .eq('status', 'active')
    .eq('wizard_completed', true);

  if (staffError) {
    console.error('[catalog] Staff query error:', staffError.message);
  }

  const staffIds = (staffRows ?? []).map(s => s.id);
  const staffTagMap: Record<string, Array<{ id: string; name: string; extra_price: number }>> = {};

  if (staffIds.length > 0) {
    const { data: tagJoins, error: tagError } = await supabase
      .from('staff_service_tags')
      .select('staff_id, tag_id, service_tags(id, name, extra_price)')
      .in('staff_id', staffIds);

    if (tagError) {
      console.error('[catalog] Staff tags query error:', tagError.message);
    }

    for (const join of tagJoins ?? []) {
      const tag = Array.isArray(join.service_tags) ? join.service_tags[0] : join.service_tags;
      if (tag) {
        if (!staffTagMap[join.staff_id]) staffTagMap[join.staff_id] = [];
        staffTagMap[join.staff_id].push({ id: tag.id, name: tag.name, extra_price: tag.extra_price ?? 0 });
      }
    }
  }

  const staff: CatalogStaff[] = (staffRows ?? []).map(s => ({
    id: s.id,
    pseudonym: s.pseudonym,
    bio: s.bio,
    photo_urls: s.photo_urls,
    social_links: (s.social_links ?? {}) as Record<string, string>,
    gender: s.gender,
    nationality: s.nationality,
    age: s.age,
    languages: s.languages,
    tags: staffTagMap[s.id] ?? [],
  }));

  const { data: allTags } = await supabase
    .from('service_tags')
    .select('id, name, extra_price')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('display_order');

  const { data: tenantConfig } = await supabase
    .from('tenant_config')
    .select('terminology, feature_flags')
    .eq('tenant_id', tenant.id)
    .maybeSingle();

  const terminology = (tenantConfig?.terminology as Terminology | undefined) ?? DEFAULT_TERMINOLOGY;
  const featureFlags = (tenantConfig?.feature_flags as FeatureFlags | undefined) ?? DEFAULT_FEATURE_FLAGS;

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      vertical: tenant.vertical,
      client_mode: tenant.client_mode as 'guest' | 'account',
    },
    settings: (settings as CatalogSettings | null) ?? null,
    staff,
    tags: allTags ?? [],
    terminology,
    featureFlags,
  };
}
