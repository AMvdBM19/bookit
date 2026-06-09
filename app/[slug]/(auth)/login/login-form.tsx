'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const inputCls =
  'w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-fg placeholder-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-border-strong';

export default function LoginForm({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const redirect = searchParams.get('redirect') ?? `/${slug}/dashboard`;
    window.location.href = redirect;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-fg-muted mb-1" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className={inputCls}
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className="block text-xs text-fg-muted mb-1" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className={inputCls}
          placeholder="••••••••"
        />
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-fg text-canvas rounded-lg py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
