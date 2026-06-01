import { resolveTenant } from '@/lib/auth/tenant';
import { notFound } from 'next/navigation';
import LoginForm from './login-form';

export default async function LoginPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);

  if (!tenant || !tenant.isActive) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-zinc-900 rounded-xl border border-zinc-800 p-8 shadow-lg">
        <h1 className="text-white text-xl font-semibold mb-1">Sign in</h1>
        <p className="text-zinc-400 text-sm mb-6">{tenant.name}</p>
        <LoginForm slug={slug} />
        <div className="mt-4 text-center">
          <a
            href={`/${slug}/forgot-password`}
            className="text-xs text-zinc-500 hover:text-white transition-colors"
          >
            Forgot password?
          </a>
        </div>
      </div>
    </div>
  );
}
