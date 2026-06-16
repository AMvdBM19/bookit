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
  tags: Array<{
    id: string;
    name: string;
    description: string | null;
    extra_price: number;
    duration_minutes: number | null;
    blocks_slot: boolean;
    allow_quantity: boolean;
    max_quantity: number;
  }>;
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
  max_booking_days_ahead?: number | null;
  currency: string;
  deposit_pct: number | null;
  deposit_required_above_minutes: number | null;
  widget_primary_color: string | null;
  widget_accent_color: string | null;
  widget_bg: string | null;
  widget_bg_custom: string | null;
  widget_font_pair: string | null;
  widget_border_radius: string | null;
  widget_card_style: string | null;
  widget_spacing: string | null;
  widget_text_color: string | null;
  widget_text_muted: string | null;
  widget_surface_color: string | null;
  widget_border_color: string | null;
  widget_show_powered_by: boolean | null;
  widget_logo_url: string | null;
  /** Optional until the per-service-duration migration is applied. */
  per_service_duration_enabled?: boolean | null;
  /** Widget chrome language — 'en' (default) or 'nl'. */
  widget_language?: string | null;
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
  tags: Array<{
    id: string;
    name: string;
    description?: string | null;
    extra_price: number | null;
    duration_minutes?: number | null;
    blocks_slot?: boolean | null;
    allow_quantity?: boolean | null;
    max_quantity?: number | null;
  }>;
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

  // select('*') keeps this resilient to additive columns (e.g.
  // per_service_duration_enabled) that may not exist until migrations run.
  const { data: settings, error: settingsError } = await supabase
    .from('tenant_settings')
    .select('*')
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
  const staffTagMap: Record<string, CatalogStaff['tags']> = {};

  if (staffIds.length > 0) {
    const { data: tagJoins, error: tagError } = await supabase
      .from('staff_service_tags')
      .select('staff_id, tag_id, service_tags(*)')
      .in('staff_id', staffIds);

    if (tagError) {
      console.error('[catalog] Staff tags query error:', tagError.message);
    }

    for (const join of tagJoins ?? []) {
      const tag = Array.isArray(join.service_tags) ? join.service_tags[0] : join.service_tags;
      if (tag) {
        if (!staffTagMap[join.staff_id]) staffTagMap[join.staff_id] = [];
        const t = tag as {
          duration_minutes?: number | null;
          description?: string | null;
          blocks_slot?: boolean | null;
          allow_quantity?: boolean | null;
          max_quantity?: number | null;
        };
        staffTagMap[join.staff_id].push({
          id: tag.id,
          name: tag.name,
          description: t.description ?? null,
          extra_price: tag.extra_price ?? 0,
          duration_minutes: t.duration_minutes ?? null,
          blocks_slot: t.blocks_slot ?? true,
          allow_quantity: t.allow_quantity ?? false,
          max_quantity: t.max_quantity ?? 1,
        });
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
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('display_order');

  const { data: tenantConfig } = await supabase
    .from('tenant_config')
    .select('terminology, feature_flags')
    .eq('tenant_id', tenant.id)
    .maybeSingle();

  const terminology = { ...DEFAULT_TERMINOLOGY, ...(tenantConfig?.terminology as Partial<Terminology> | undefined) };
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
