'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const inputCls =
  'w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-fg placeholder-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-border-strong';

export default function ChangePasswordForm({
  slug,
  staffId,
}: {
  slug: string;
  staffId?: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    if (staffId) {
      await fetch('/api/internal/staff/mark-password-set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId }),
      });
      router.push(`/${slug}/staff-setup`);
    } else {
      router.push(`/${slug}/dashboard`);
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-fg-muted mb-1" htmlFor="password">
          New password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className={inputCls}
          placeholder="Min. 8 characters"
        />
      </div>
      <div>
        <label className="block text-xs text-fg-muted mb-1" htmlFor="confirm">
          Confirm password
        </label>
        <input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          className={inputCls}
          placeholder="Repeat password"
        />
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-fg text-canvas rounded-lg py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {loading ? 'Saving…' : 'Set password'}
      </button>
    </form>
  );
}
