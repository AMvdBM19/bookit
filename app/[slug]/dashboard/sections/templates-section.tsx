'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Spinner from '@/components/ui/spinner';

interface Template {
  id: string;
  event_type: string;
  channel: 'whatsapp' | 'email';
  subject: string | null;
  body: string;
  is_active: boolean;
  updated_at: string;
}

interface ApiResponse {
  templates: Template[];
  variables: Record<string, string[]>;
  eventTypes: string[];
  channels: Array<'whatsapp' | 'email'>;
}

const EVENT_LABELS: Record<string, string> = {
  booking_confirmed: 'Booking confirmed',
  booking_declined: 'Booking declined',
  booking_reminder: 'Booking reminder',
  booking_cancelled: 'Booking cancelled',
  client_approved: 'Client approved',
};

const CHANNEL_BADGE: Record<string, string> = {
  whatsapp: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  email: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
};

interface EditDraft {
  event_type: string;
  channel: 'whatsapp' | 'email';
  subject: string;
  body: string;
}

export default function TemplatesSection({ slug }: { slug: string }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${slug}/notifications/templates`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Failed to load templates');
        return;
      }
      setData(body);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    reload();
  }, [reload]);

  function startEdit(eventType: string, channel: 'whatsapp' | 'email', existing?: Template) {
    setSaveError(null);
    setDraft({
      event_type: eventType,
      channel,
      subject: existing?.subject ?? '',
      body: existing?.body ?? '',
    });
  }

  function cancelEdit() {
    setDraft(null);
    setSaveError(null);
  }

  async function saveDraft() {
    if (!draft) return;
    if (!draft.body.trim()) {
      setSaveError('Body is required');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/${slug}/notifications/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: draft.event_type,
          channel: draft.channel,
          subject: draft.channel === 'email' ? draft.subject || null : null,
          body: draft.body,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setSaveError(body.error ?? 'Failed to save');
        toast.error(body.error ?? "Couldn't save template. Please try again.");
        return;
      }
      toast.success('Template saved.');
      setDraft(null);
      await reload();
    } catch {
      setSaveError('Network error');
      toast.error("Couldn't save template. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-fg-muted">
        <Spinner size="lg" />
      </div>
    );
  }
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!data) return null;

  // Group existing templates by event_type → channel
  const byEvent: Record<string, Partial<Record<'whatsapp' | 'email', Template>>> = {};
  for (const t of data.templates) {
    if (!byEvent[t.event_type]) byEvent[t.event_type] = {};
    byEvent[t.event_type][t.channel] = t;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-fg">Notification templates</h2>
        <p className="text-xs text-fg-muted mt-1">
          Configure WhatsApp and email templates for each event. Use{' '}
          <code className="px-1 py-0.5 bg-elevated rounded text-[11px]">[variable]</code> placeholders.
        </p>
      </div>

      <div className="space-y-4">
        {data.eventTypes.map(evt => {
          const channels = byEvent[evt] ?? {};
          const vars = data.variables[evt] ?? [];

          return (
            <section
              key={evt}
              className="bg-surface border border-border rounded-lg overflow-hidden"
            >
              <header className="px-4 py-3 border-b border-border bg-elevated">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-fg">
                    {EVENT_LABELS[evt] ?? evt}
                  </h3>
                  <code className="text-[10px] text-fg-muted font-mono">{evt}</code>
                </div>
                {vars.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {vars.map(v => (
                      <code
                        key={v}
                        className="text-[10px] bg-sunken text-fg-muted px-1.5 py-0.5 rounded"
                      >
                        [{v}]
                      </code>
                    ))}
                  </div>
                )}
              </header>

              <div className="divide-y divide-border">
                {data.channels.map(ch => {
                  const existing = channels[ch];
                  const isEditing =
                    draft?.event_type === evt && draft.channel === ch;

                  return (
                    <div key={ch} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded border ${CHANNEL_BADGE[ch]}`}
                        >
                          {ch}
                        </span>

                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => startEdit(evt, ch, existing)}
                            className="text-xs px-2 py-1 bg-elevated hover:bg-sunken text-fg rounded transition-colors"
                          >
                            {existing ? 'Edit' : 'Add'}
                          </button>
                        )}
                      </div>

                      {isEditing && draft ? (
                        <div className="space-y-2">
                          {draft.channel === 'email' && (
                            <input
                              type="text"
                              value={draft.subject}
                              onChange={e =>
                                setDraft({ ...draft, subject: e.target.value })
                              }
                              placeholder="Subject (email only)"
                              className="w-full text-sm bg-elevated border border-border rounded px-3 py-2 text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-border-strong"
                            />
                          )}
                          <textarea
                            value={draft.body}
                            onChange={e => setDraft({ ...draft, body: e.target.value })}
                            placeholder="Template body — use [variable] placeholders"
                            className="w-full text-sm bg-elevated border border-border rounded px-3 py-2 text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-border-strong h-28 resize-none font-mono"
                          />
                          {saveError && (
                            <p className="text-xs text-red-500">{saveError}</p>
                          )}
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={saving}
                              className="text-xs px-3 py-1.5 text-fg-muted hover:bg-elevated rounded"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={saveDraft}
                              disabled={saving}
                              className="text-xs px-3 py-1.5 bg-fg text-canvas rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </div>
                      ) : existing ? (
                        <div>
                          {existing.subject && (
                            <p className="text-[11px] text-fg-muted mb-1">
                              <span className="text-fg-subtle">Subject:</span>{' '}
                              {existing.subject}
                            </p>
                          )}
                          <pre className="text-xs text-fg-muted whitespace-pre-wrap font-sans bg-elevated border border-border rounded p-2">
                            {existing.body}
                          </pre>
                        </div>
                      ) : (
                        <p className="text-xs text-fg-muted italic">
                          Not configured. Messages for this event will not be sent on {ch}.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
