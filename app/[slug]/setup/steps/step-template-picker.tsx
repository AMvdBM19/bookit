'use client';

import { useEffect, useState } from 'react';

interface TemplateCard {
  slug: string;
  label: string;
  icon: string;
  description: string | null;
  sort_order: number;
}

interface Props {
  slug: string;
  /** Called after a template has been successfully stamped onto the tenant. */
  onSelected: () => void;
}

export default function StepTemplatePicker({ slug, onSelected }: Props) {
  const [templates, setTemplates] = useState<TemplateCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/templates/active');
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(data.error ?? 'Failed to load templates.');
          return;
        }
        setTemplates(data.templates ?? []);
      } catch {
        if (!cancelled) setLoadError('Network error loading templates.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleContinue() {
    if (!selected) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/${slug}/setup/select-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_slug: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? 'Failed to apply template.');
        return;
      }
      onSelected();
    } catch {
      setSubmitError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading industry templates…</p>;
  }

  if (loadError) {
    return <p className="text-sm text-red-400">{loadError}</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        Choose the template that best matches your business. It pre-configures
        terminology, booking rules, and compliance for your industry. You can fine-tune
        everything in the next steps.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {templates.map(t => {
          const isSelected = selected === t.slug;
          return (
            <button
              key={t.slug}
              type="button"
              onClick={() => setSelected(t.slug)}
              className={`text-left rounded-lg p-4 cursor-pointer transition-all border ${
                isSelected
                  ? 'border-green-500 ring-2 ring-green-500/20 bg-green-500/5'
                  : 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/40'
              }`}
            >
              <div className="text-2xl mb-2">{t.icon}</div>
              <p className="text-sm font-semibold text-white">{t.label}</p>
              {t.description && (
                <p className="text-xs text-zinc-400 mt-1">{t.description}</p>
              )}
            </button>
          );
        })}
      </div>

      {submitError && <p className="text-red-400 text-xs">{submitError}</p>}

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleContinue}
          disabled={!selected || submitting}
          className="px-6 py-2 bg-white text-zinc-900 text-sm font-medium rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Applying…' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
