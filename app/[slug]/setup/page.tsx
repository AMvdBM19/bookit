import { getAuthenticatedUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

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

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <p className="text-zinc-400 text-sm">Onboarding wizard — Phase 3</p>
    </div>
  );
}
