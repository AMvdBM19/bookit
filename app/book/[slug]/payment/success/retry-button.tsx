'use client';

import { useState } from 'react';

// Regenerates a checkout URL for an unpaid deposit and redirects the client
// straight to the new Mollie page.
export default function RetryButton({ slug, bookingId }: { slug: string; bookingId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/book/${slug}/api/payments/status?booking_id=${bookingId}`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.checkout_url) {
        setError("Couldn't start a new payment. Please contact the business.");
        return;
      }
      window.location.href = data.checkout_url;
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={retry}
        disabled={busy}
        className="w-full w-btn w-round py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: 'var(--w-primary)', color: '#fff' }}
      >
        {busy ? 'Starting…' : 'Try payment again'}
      </button>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}
