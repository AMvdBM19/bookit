import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = createServiceClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, vertical, client_mode, is_active')
    .eq('slug', slug)
    .single();

  if (!tenant || !tenant.is_active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

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

  const staff = (staffList ?? []).map(s => {
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
      social_links: s.social_links,
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

  return NextResponse.json({
    tenant: {
      id: tenant.id,
      name: tenant.name,
      vertical: tenant.vertical,
      client_mode: tenant.client_mode,
    },
    settings: settings ?? null,
    staff,
    tags: allTags ?? [],
  });
}
