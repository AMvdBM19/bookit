import { createServiceClient } from '@/lib/supabase/server';
import { getVerticalConfig, isValidVertical } from '@/lib/verticals';
import type { VerticalTerminology, VerticalDefaults } from '@/lib/verticals/types';

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
  terminology: VerticalTerminology;
  defaults: VerticalDefaults;
}

export async function loadCatalog(slug: string): Promise<Catalog | null> {
  const supabase = createServiceClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, vertical, client_mode, is_active')
    .eq('slug', slug)
    .single();

  if (!tenant || !tenant.is_active) return null;

  const { data: settings } = await supabase
    .from('tenant_settings')
    .select(
      'brand_color, agency_display_name, logo_url, show_price_to_client, base_rate_per_30min, age_gate_minimum, require_age_confirm, booking_confirm_mode, default_slot_minutes, min_lead_time_hours, currency'
    )
    .eq('tenant_id', tenant.id)
    .single();

  const { data: staffList } = await supabase
    .from('staff')
    .select(`
      id, pseudonym, bio, photo_urls, social_links, gender, nationality, age, languages,
      staff_service_tags(tag_id, service_tags(id, name, extra_price))
    `)
    .eq('tenant_id', tenant.id)
    .eq('status', 'active')
    .eq('wizard_completed', true);

  const staff: CatalogStaff[] = (staffList ?? []).map(s => {
    const tagJoins = s.staff_service_tags as unknown as Array<{
      tag_id: string;
      service_tags:
        | { id: string; name: string; extra_price: number | null }
        | Array<{ id: string; name: string; extra_price: number | null }>
        | null;
    }>;
    const tags = (tagJoins ?? [])
      .map(t => {
        const tag = Array.isArray(t.service_tags) ? t.service_tags[0] : t.service_tags;
        return tag ? { id: tag.id, name: tag.name, extra_price: tag.extra_price ?? 0 } : null;
      })
      .filter((x): x is { id: string; name: string; extra_price: number } => x !== null);

    return {
      id: s.id,
      pseudonym: s.pseudonym,
      bio: s.bio,
      photo_urls: s.photo_urls,
      social_links: (s.social_links ?? {}) as Record<string, string>,
      gender: s.gender,
      nationality: s.nationality,
      age: s.age,
      languages: s.languages,
      tags,
    };
  });

  const { data: allTags } = await supabase
    .from('service_tags')
    .select('id, name, extra_price')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('display_order');

  const verticalId = isValidVertical(tenant.vertical) ? tenant.vertical : 'adult_services';
  const config = getVerticalConfig(verticalId);

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
    terminology: config.terminology,
    defaults: config.defaults,
  };
}
