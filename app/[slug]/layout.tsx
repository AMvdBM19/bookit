import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
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

  // Middleware handles the wizard redirect as primary gate; this is the layout-level fallback.
  const headersList = await headers();
  const nextUrl = headersList.get('next-url') ?? '';
  if (
    !tenant.wizardCompleted &&
    !nextUrl.includes('/setup') &&
    !nextUrl.includes('/change-password') &&
    !nextUrl.includes('/staff-setup')
  ) {
    redirect(`/${slug}/setup`);
  }

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
