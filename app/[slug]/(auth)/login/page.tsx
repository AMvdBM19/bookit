import { resolveTenant } from '@/lib/auth/tenant';
import { notFound } from 'next/navigation';
import LoginForm from './login-form';
import ThemeToggle from '@/app/components/theme-toggle';

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
    <div className="min-h-screen bg-canvas text-fg flex items-center justify-center px-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle variant="surface" />
      </div>
      <div className="w-full max-w-sm bg-surface rounded-xl border border-border p-8 shadow-lg">
        <h1 className="text-fg text-xl font-semibold mb-1">Sign in</h1>
        <p className="text-fg-muted text-sm mb-6">{tenant.name}</p>
        <LoginForm slug={slug} />
        <div className="mt-4 text-center">
          <a
            href={`/${slug}/forgot-password`}
            className="text-xs text-fg-muted hover:text-fg transition-colors"
          >
            Forgot password?
          </a>
        </div>
      </div>
    </div>
  );
}
