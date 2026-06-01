import { getAuthenticatedUser } from '@/lib/auth/session';
import { resolveTenant } from '@/lib/auth/tenant';
import { redirect } from 'next/navigation';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect(`/${slug}/login`);
  }

  const tenant = await resolveTenant(slug);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <p className="text-zinc-400 text-sm">
        Dashboard — {tenant?.name ?? slug} [{tenant?.vertical ?? ''}]
      </p>
    </div>
  );
}
