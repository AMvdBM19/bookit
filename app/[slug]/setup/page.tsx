import { getAuthenticatedUser } from '@/lib/auth/session';
import { resolveTenant } from '@/lib/auth/tenant';
import { getVerticalConfig } from '@/lib/verticals';
import { redirect } from 'next/navigation';
import WizardShell from './wizard-shell';

export default async function SetupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect(`/${slug}/login`);
  }

  if (user.role !== 'agent') {
    redirect(`/${slug}/dashboard`);
  }

  const tenant = await resolveTenant(slug);

  if (!tenant) {
    redirect(`/${slug}/login`);
  }

  if (tenant.wizardCompleted) {
    redirect(`/${slug}/dashboard`);
  }

  const config = getVerticalConfig(tenant.vertical);

  return (
    <WizardShell
      slug={slug}
      tenantName={tenant.name}
      config={config}
    />
  );
}
