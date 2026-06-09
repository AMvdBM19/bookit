// BUG 6 FIX: Root page is a Book-IT branded landing with tenant slug input, not Next.js template.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/app/components/theme-toggle';

export default function Home() {
  const router = useRouter();
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = slug.trim().toLowerCase();
    if (!trimmed) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(
        `/api/tenant-check?slug=${encodeURIComponent(trimmed)}`
      );

      if (res.ok) {
        router.push(`/${trimmed}`);
      } else if (res.status === 404) {
        setError('No account found with that slug.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-fg flex flex-col items-center justify-center px-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle variant="surface" />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-fg tracking-tight">Book-IT</h1>
          <p className="mt-2 text-sm text-fg-muted">
            Multi-vertical appointment management
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="slug" className="block text-xs font-medium text-fg-muted mb-1.5">
              Your account slug
            </label>
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={e => setSlug(e.target.value)}
              placeholder="inkhaus"
              autoComplete="off"
              spellCheck={false}
              className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-fg placeholder-fg-subtle text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-border-strong"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !slug.trim()}
            className="w-full bg-fg text-canvas font-medium text-sm py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {loading ? 'Checking...' : 'Go to my account'}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-fg-subtle">
          Powered by{' '}
          <span className="text-fg-muted font-medium">Monoliet.cloud</span>
        </p>
      </div>
    </div>
  );
}
