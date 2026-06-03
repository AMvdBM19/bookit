'use client';

import { useCallback, useEffect, useState } from 'react';

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
  whatsapp: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  email: 'bg-blue-100 text-blue-800 border-blue-200',
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
        return;
      }
      setDraft(null);
      await reload();
    } catch {
      setSaveError('Network error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading templates…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
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
        <h2 className="text-sm font-semibold text-zinc-900">Notification templates</h2>
        <p className="text-xs text-zinc-500 mt-1">
          Configure WhatsApp and email templates for each event. Use{' '}
          <code className="px-1 py-0.5 bg-zinc-200 rounded text-[11px]">[variable]</code> placeholders.
        </p>
      </div>

      <div className="space-y-4">
        {data.eventTypes.map(evt => {
          const channels = byEvent[evt] ?? {};
          const vars = data.variables[evt] ?? [];

          return (
            <section
              key={evt}
              className="bg-white border border-zinc-200 rounded-lg overflow-hidden"
            >
              <header className="px-4 py-3 border-b border-zinc-200 bg-zinc-50">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-zinc-900">
                    {EVENT_LABELS[evt] ?? evt}
                  </h3>
                  <code className="text-[10px] text-zinc-500 font-mono">{evt}</code>
                </div>
                {vars.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {vars.map(v => (
                      <code
                        key={v}
                        className="text-[10px] bg-zinc-200 text-zinc-700 px-1.5 py-0.5 rounded"
                      >
                        [{v}]
                      </code>
                    ))}
                  </div>
                )}
              </header>

              <div className="divide-y divide-zinc-200">
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
                            className="text-xs px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded"
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
                              className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:outline-none focus:border-zinc-500"
                            />
                          )}
                          <textarea
                            value={draft.body}
                            onChange={e => setDraft({ ...draft, body: e.target.value })}
                            placeholder="Template body — use [variable] placeholders"
                            className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:outline-none focus:border-zinc-500 h-28 resize-none font-mono"
                          />
                          {saveError && (
                            <p className="text-xs text-red-600">{saveError}</p>
                          )}
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={saving}
                              className="text-xs px-3 py-1.5 text-zinc-700 hover:bg-zinc-100 rounded"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={saveDraft}
                              disabled={saving}
                              className="text-xs px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded disabled:opacity-50"
                            >
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </div>
                      ) : existing ? (
                        <div>
                          {existing.subject && (
                            <p className="text-[11px] text-zinc-500 mb-1">
                              <span className="text-zinc-400">Subject:</span>{' '}
                              {existing.subject}
                            </p>
                          )}
                          <pre className="text-xs text-zinc-700 whitespace-pre-wrap font-sans bg-zinc-50 border border-zinc-200 rounded p-2">
                            {existing.body}
                          </pre>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500 italic">
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
