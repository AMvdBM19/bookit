'use client';

import { useEffect, useState } from 'react';
import { useTenantConfig } from '@/lib/context/tenant-config';
import Button from '@/components/ui/button';

interface Props {
  slug: string;
  onNavigate: (tab: 'staff' | 'widget') => void;
}

function CheckCircle({ done }: { done: boolean }) {
  return done ? (
    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  ) : (
    <span className="w-5 h-5 rounded-full border-2 border-border-strong shrink-0" />
  );
}

export default function OnboardingChecklist({ slug, onNavigate }: Props) {
  const { terminology } = useTenantConfig();
  const dismissKey = `bookit:onboarding-dismissed:${slug}`;

  const [dismissed, setDismissed] = useState(true); // assume dismissed until localStorage read
  const [loaded, setLoaded] = useState(false);
  const [hasStaff, setHasStaff] = useState(false);
  const [widgetCustomized, setWidgetCustomized] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(dismissKey) === '1');
  }, [dismissKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [staffRes, settingsRes] = await Promise.all([
          fetch(`/api/${slug}/staff`),
          fetch(`/api/${slug}/settings/summary`),
        ]);
        const staffData = await staffRes.json().catch(() => ({}));
        const settingsData = await settingsRes.json().catch(() => ({}));
        if (cancelled) return;
        setHasStaff((staffData.staff ?? []).length > 0);
        // Saving any widget theme always writes widget_font_pair.
        setWidgetCustomized(settingsData.settings?.widget_font_pair != null);
        setLoaded(true);
      } catch {
        if (!cancelled) setLoaded(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  function dismiss() {
    localStorage.setItem(dismissKey, '1');
    setDismissed(true);
  }

  const items = [
    {
      key: 'staff',
      done: hasStaff,
      title: 'Add your first team member',
      description: `${terminology.client_plural} book with your ${terminology.staff_plural.toLowerCase()}.`,
      actionLabel: `Add ${terminology.staff.toLowerCase()}`,
      action: () => onNavigate('staff'),
    },
    {
      key: 'widget',
      done: widgetCustomized,
      title: 'Customize your widget',
      description: 'Match the booking widget to your brand, then grab your link and embed code there.',
      actionLabel: 'Open Widget tab',
      action: () => onNavigate('widget'),
    },
  ];

  const doneCount = items.filter(i => i.done).length;
  const allComplete = doneCount === items.length;

  if (dismissed || !loaded || allComplete) return null;

  return (
    <div className="mb-6 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-fg">Getting started</h2>
          <p className="text-xs text-fg-muted mt-0.5">{doneCount} of {items.length} completed</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-fg-muted hover:text-fg text-xs rounded px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Dismiss checklist"
        >
          ✕
        </button>
      </div>

      <div className="h-1 rounded-full bg-elevated mb-4 overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${(doneCount / items.length) * 100}%` }}
        />
      </div>

      <ul className="space-y-3">
        {items.map(item => (
          <li key={item.key} className="flex items-center gap-3">
            <CheckCircle done={item.done} />
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${item.done ? 'text-fg-muted line-through' : 'text-fg'}`}>
                {item.title}
              </p>
              {!item.done && <p className="text-xs text-fg-muted">{item.description}</p>}
            </div>
            {!item.done && (
              <Button variant="outline" size="sm" onClick={item.action} className="shrink-0">
                {item.actionLabel}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
