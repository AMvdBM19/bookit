import { getAuthenticatedUser } from '@/lib/auth/session';
import { resolveTenant } from '@/lib/auth/tenant';
import { createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import WizardShell from './wizard-shell';

// Service-client queries must not be served from Next's data cache (see
// "Known gotcha" in CLAUDE.md).
export const dynamic = 'force-dynamic';

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

  // Service tags are seeded when a template is selected; show any that already exist
  // so the agent can review them in the Services step.
  const supabase = createServiceClient();
  const { data: tags } = await supabase
    .from('service_tags')
    .select('name')
    .eq('tenant_id', tenant.tenantId)
    .order('display_order');

  const initialServiceTags = (tags ?? []).map(t => t.name);

  return (
    <WizardShell
      slug={slug}
      tenantName={tenant.name}
      initialServiceTags={initialServiceTags}
    />
  );
}
