import { cache } from 'react';
import { createServiceClient } from '@/lib/supabase/server';
import type { TenantContext } from '@/lib/types/auth';
import type { VerticalId } from '@/lib/verticals/types';
import { isValidVertical } from '@/lib/verticals';

export const resolveTenant = cache(async (slug: string): Promise<TenantContext | null> => {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('tenants')
    .select('id, slug, name, vertical, client_mode, is_active, wizard_completed')
    .eq('slug', slug)
    .single();

  if (error || !data) return null;

  const vertical = isValidVertical(data.vertical) ? data.vertical : 'adult_services';

  return {
    tenantId: data.id,
    slug: data.slug,
    name: data.name,
    vertical: vertical as VerticalId,
    clientMode: data.client_mode as 'account' | 'guest',
    isActive: data.is_active,
    wizardCompleted: data.wizard_completed,
  };
});

/** Lightweight tenant resolution for middleware — uses REST API directly, no SDK overhead. */
export async function resolveTenantSlug(slug: string): Promise<{
  id: string;
  slug: string;
  vertical: string;
  client_mode: string;
  is_active: boolean;
  wizard_completed: boolean;
} | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) return null;

    const url = `${supabaseUrl}/rest/v1/tenants?slug=eq.${encodeURIComponent(slug)}&select=id,slug,vertical,client_mode,is_active,wizard_completed&limit=1`;

    const res = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data?.[0] ?? null;
  } catch {
    return null;
  }
}
