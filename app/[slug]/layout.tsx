import { notFound } from 'next/navigation';
import { resolveTenant } from '@/lib/auth/tenant';
import { createServiceClient } from '@/lib/supabase/server';
import { TenantProvider } from '@/lib/context/tenant';
import { TenantConfigProvider } from '@/lib/context/tenant-config';
import {
  DEFAULT_TERMINOLOGY,
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_COMPLIANCE_FLAGS,
} from '@/lib/types/tenant-config';

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);

  if (!tenant || !tenant.isActive) {
    notFound();
  }

  // The wizard redirect gate lives entirely in middleware.ts — it has the request
  // path and handles both directions (incomplete → setup, complete-on-setup →
  // dashboard). A layout-level fallback was removed: it relied on a `next-url`
  // header that is never set, so it always fired and looped on /setup itself.

  const supabaseAdmin = createServiceClient();
  const { data: tenantConfig } = await supabaseAdmin
    .from('tenant_config')
    .select('terminology, feature_flags, compliance_flags, source_template_slug')
    .eq('tenant_id', tenant.tenantId)
    .single();

  const terminology = tenantConfig?.terminology ?? DEFAULT_TERMINOLOGY;
  const featureFlags = tenantConfig?.feature_flags ?? DEFAULT_FEATURE_FLAGS;
  const complianceFlags = tenantConfig?.compliance_flags ?? DEFAULT_COMPLIANCE_FLAGS;
  const sourceTemplateSlug = tenantConfig?.source_template_slug ?? null;

  return (
    <TenantProvider context={tenant}>
      <TenantConfigProvider
        terminology={terminology}
        featureFlags={featureFlags}
        complianceFlags={complianceFlags}
        sourceTemplateSlug={sourceTemplateSlug}
      >
        {children}
      </TenantConfigProvider>
    </TenantProvider>
  );
}
