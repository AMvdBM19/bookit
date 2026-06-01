import { getAuthenticatedUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import ChangePasswordForm from './change-password-form';

export default async function ChangePasswordPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect(`/${slug}/login`);
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-zinc-900 rounded-xl border border-zinc-800 p-8 shadow-lg">
        <h1 className="text-white text-xl font-semibold mb-1">Set your password</h1>
        <p className="text-zinc-400 text-sm mb-6">Choose a new password before continuing.</p>
        <ChangePasswordForm slug={slug} staffId={user.staffId} />
      </div>
    </div>
  );
}
