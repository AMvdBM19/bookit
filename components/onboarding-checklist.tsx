'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTenantConfig } from '@/lib/context/tenant-config';
import Button from '@/components/ui/button';
import ConfirmDialog from '@/components/ui/confirm-dialog';

// Settings' "Getting started" link dispatches this to re-open a dismissed
// checklist without a page reload.
export const ONBOARDING_REOPEN_EVENT = 'bookit:onboarding-reopen';

interface Props {
  slug: string;
  onNavigate: (tab: 'staff' | 'widget') => void;
}

function CheckCircle({ done, unknown }: { done: boolean; unknown?: boolean }) {
  if (unknown) {
    return (
      <span
        className="w-5 h-5 rounded-full border-2 border-dashed border-border-strong shrink-0"
        title="Status unknown"
      />
    );
  }
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
  const sharedKey = `bookit:onboarding-link-shared:${slug}`;

  const [dismissed, setDismissed] = useState(true); // assume dismissed until localStorage read
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [hasStaff, setHasStaff] = useState(false);
  const [widgetCustomized, setWidgetCustomized] = useState(false);
  const [linkShared, setLinkShared] = useState(false);
  const [confirmDismiss, setConfirmDismiss] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(dismissKey) === '1');
    setLinkShared(localStorage.getItem(sharedKey) === '1');
  }, [dismissKey, sharedKey]);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const [staffRes, settingsRes] = await Promise.all([
        fetch(`/api/${slug}/staff`),
        fetch(`/api/${slug}/settings/summary`),
      ]);
      if (!staffRes.ok || !settingsRes.ok) {
        setStatus('error');
        return;
      }
      const staffData = await staffRes.json().catch(() => ({}));
      const settingsData = await settingsRes.json().catch(() => ({}));
      setHasStaff((staffData.staff ?? []).length > 0);
      setWidgetCustomized(settingsData.settings?.widget_customized_at != null);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  // Re-open from Settings → "Getting started".
  useEffect(() => {
    function reopen() {
      localStorage.removeItem(dismissKey);
      setDismissed(false);
      load();
    }
    window.addEventListener(ONBOARDING_REOPEN_EVENT, reopen);
    return () => window.removeEventListener(ONBOARDING_REOPEN_EVENT, reopen);
  }, [dismissKey, load]);

  async function shareLink() {
    const url = `${window.location.origin}/book/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Booking link copied to clipboard.');
    } catch {
      // Clipboard can be unavailable (permissions, http) — still surface the URL.
      toast.info(`Your booking link: ${url}`);
    }
    localStorage.setItem(sharedKey, '1');
    setLinkShared(true);
  }

  const unknown = status === 'error';
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
      description: 'Match the booking widget to your brand and save a theme.',
      actionLabel: 'Open Widget tab',
      action: () => onNavigate('widget'),
    },
    {
      key: 'share',
      done: linkShared,
      title: 'Share your booking link',
      description: `Send the link to your ${terminology.client_plural.toLowerCase()} or put it on your website.`,
      actionLabel: 'Copy link',
      action: shareLink,
    },
  ];

  const doneCount = items.filter(i => i.done).length;
  const allComplete = status === 'ready' && doneCount === items.length;

  if (dismissed || allComplete) return null;

  if (status === 'loading') {
    return (
      <div className="mb-6 rounded-lg border border-border bg-surface p-4 animate-pulse" aria-hidden="true">
        <div className="h-4 w-32 bg-elevated rounded mb-2" />
        <div className="h-3 w-24 bg-elevated rounded mb-4" />
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-elevated shrink-0" />
              <div className="h-3 flex-1 max-w-[240px] bg-elevated rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-fg">Getting started</h2>
          <p className="text-xs text-fg-muted mt-0.5">
            {unknown ? (
              <>
                Couldn&apos;t check your progress.{' '}
                <button
                  type="button"
                  onClick={load}
                  className="underline hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  Retry
                </button>
              </>
            ) : (
              `${doneCount} of ${items.length} completed`
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmDismiss(true)}
          className="text-fg-muted hover:text-fg text-xs rounded px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Dismiss checklist"
        >
          ✕
        </button>
      </div>

      {!unknown && (
        <div className="h-1 rounded-full bg-elevated mb-4 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${(doneCount / items.length) * 100}%` }}
          />
        </div>
      )}

      <ul className="space-y-3">
        {items.map(item => (
          <li key={item.key} className="flex items-center gap-3">
            <CheckCircle done={item.done} unknown={unknown && item.key !== 'share'} />
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${!unknown && item.done ? 'text-fg-muted line-through' : 'text-fg'}`}>
                {item.title}
              </p>
              {(unknown || !item.done) && (
                <p className="text-xs text-fg-muted">{item.description}</p>
              )}
            </div>
            {(unknown ? item.key === 'share' && !item.done : !item.done) && (
              <Button variant="outline" size="sm" onClick={item.action} className="shrink-0">
                {item.actionLabel}
              </Button>
            )}
          </li>
        ))}
      </ul>

      {confirmDismiss && (
        <ConfirmDialog
          title="Hide the getting-started checklist?"
          description='You can bring it back any time from Settings → "Getting started".'
          confirmLabel="Hide checklist"
          onConfirm={() => {
            localStorage.setItem(dismissKey, '1');
            setDismissed(true);
            setConfirmDismiss(false);
          }}
          onClose={() => setConfirmDismiss(false)}
        />
      )}
    </div>
  );
}
