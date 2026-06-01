import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { resolveTenant } from '@/lib/auth/tenant';
import { getVerticalConfig } from '@/lib/verticals';
import { TenantProvider } from '@/lib/context/tenant';
import { VerticalProvider } from '@/lib/context/vertical';

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

  const config = getVerticalConfig(tenant.vertical);

  return (
    <TenantProvider context={tenant}>
      <VerticalProvider config={config}>{children}</VerticalProvider>
    </TenantProvider>
  );
}
