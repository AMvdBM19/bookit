'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import Spinner from '@/components/ui/spinner';
import Badge from '@/components/ui/badge';
import ConfirmDialog from '@/components/ui/confirm-dialog';

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

type Channel = 'whatsapp' | 'email';

const EVENT_LABELS: Record<string, string> = {
  booking_confirmed: 'Booking confirmed',
  booking_declined: 'Booking declined',
  booking_reminder: 'Booking reminder',
  booking_cancelled: 'Booking cancelled',
  client_approved: 'Client approved',
};

const EVENT_DESCRIPTIONS: Record<string, string> = {
  booking_confirmed: 'Sent when a booking is accepted or auto-confirmed.',
  booking_declined: 'Sent when a booking request is declined.',
  booking_reminder: 'Sent ahead of a confirmed booking by the reminder cron.',
  booking_cancelled: 'Sent when a confirmed booking is cancelled.',
  client_approved: 'Sent when a client account is approved (account mode).',
};

// Starting points for "Reset to default" — neutral wording that works for
// any tenant. Saving still goes through the normal upsert.
const DEFAULT_BODIES: Record<string, Record<Channel, string>> = {
  booking_confirmed: {
    whatsapp:
      'Hi [client_name], your booking with [staff_name] on [date] at [time] ([duration] min) is confirmed. See you soon! — [agency_name]',
    email:
      'Hi [client_name],\n\nYour booking with [staff_name] on [date] at [time] ([duration] min) is confirmed.\n\nSee you soon!\n[agency_name]',
  },
  booking_declined: {
    whatsapp:
      'Hi [client_name], unfortunately [staff_name] is unavailable at your requested time. Please pick another slot. — [agency_name]',
    email:
      'Hi [client_name],\n\nUnfortunately [staff_name] is unavailable at your requested time on [date] at [time]. Please pick another slot.\n\n[agency_name]',
  },
  booking_reminder: {
    whatsapp:
      'Reminder: your booking with [staff_name] is coming up on [date] at [time]. See you then!',
    email:
      'Hi [client_name],\n\nA quick reminder: your booking with [staff_name] is coming up on [date] at [time].\n\nSee you then!',
  },
  booking_cancelled: {
    whatsapp:
      'Hi [client_name], your booking on [date] has been cancelled. Please contact us to rebook. — [agency_name]',
    email:
      'Hi [client_name],\n\nYour booking on [date] has been cancelled. Please contact us to rebook.\n\n[agency_name]',
  },
  client_approved: {
    whatsapp:
      'Hi [client_name], your account with [agency_name] has been approved. You can now book online!',
    email:
      'Hi [client_name],\n\nYour account with [agency_name] has been approved. You can now book online!\n\n[agency_name]',
  },
};

const DEFAULT_SUBJECTS: Record<string, string> = {
  booking_confirmed: 'Your booking is confirmed',
  booking_declined: 'About your booking request',
  booking_reminder: 'Reminder: upcoming booking',
  booking_cancelled: 'Your booking was cancelled',
  client_approved: 'Your account is approved',
};

// Sample values for the live preview pane.
const SAMPLE_VALUES: Record<string, string> = {
  client_name: 'Anna',
  staff_name: 'Alex',
  date: 'Fri 20 Jun 2026',
  time: '14:00',
  duration: '60',
  agency_name: 'Your Business',
};

function renderPreview(body: string): string {
  return body.replace(/\[([a-z_]+)\]/g, (m, key) => SAMPLE_VALUES[key] ?? m);
}

export default function TemplatesSection({ slug }: { slug: string }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [eventType, setEventType] = useState('booking_confirmed');
  const [channel, setChannel] = useState<Channel>('whatsapp');

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${slug}/notifications/templates`);
      const resBody = await res.json();
      if (!res.ok) {
        setError(resBody.error ?? 'Failed to load templates');
        return;
      }
      setData(resBody);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    reload();
  }, [reload]);

  const current = data?.templates.find(
    t => t.event_type === eventType && t.channel === channel
  );

  // Load the stored template into the editor whenever the selection (or the
  // fetched data) changes.
  useEffect(() => {
    setSubject(current?.subject ?? '');
    setBody(current?.body ?? '');
    setDirty(false);
  }, [eventType, channel, current?.subject, current?.body]);

  function insertPlaceholder(variable: string) {
    const token = `[${variable}]`;
    const el = bodyRef.current;
    if (!el) {
      setBody(prev => prev + token);
      setDirty(true);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    setDirty(true);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function save() {
    if (!body.trim()) {
      toast.error('Template body is required.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/${slug}/notifications/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          channel,
          subject: channel === 'email' ? subject || null : null,
          body,
        }),
      });
      const resBody = await res.json();
      if (!res.ok) {
        toast.error(resBody.error ?? "Couldn't save template. Please try again.");
        return;
      }
      toast.success('Template saved.');
      setDirty(false);
      await reload();
    } catch {
      toast.error("Couldn't save template. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function applyDefault() {
    setBody(DEFAULT_BODIES[eventType]?.[channel] ?? '');
    if (channel === 'email') setSubject(DEFAULT_SUBJECTS[eventType] ?? '');
    setDirty(true);
    setConfirmReset(false);
    toast.info('Default loaded — review and Save to apply.');
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

  const vars = data.variables[eventType] ?? [];
  const configuredCount = (evt: string) =>
    data.templates.filter(t => t.event_type === evt).length;

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-sm font-semibold text-fg">Notification templates</h2>
        <p className="text-xs text-fg-muted mt-1">
          Pick an event and channel, then edit the message. Placeholders in{' '}
          <code className="px-1 py-0.5 bg-elevated rounded text-[11px]">[brackets]</code> are
          replaced with real values when the message is sent.
        </p>
      </div>

      {/* Event selector */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px]">
          <label className="block text-xs text-fg-muted mb-1" htmlFor="tpl-event">
            Event
          </label>
          <select
            id="tpl-event"
            value={eventType}
            onChange={e => setEventType(e.target.value)}
            className="w-full text-sm bg-elevated text-fg border border-border rounded px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {data.eventTypes.map(evt => (
              <option key={evt} value={evt}>
                {EVENT_LABELS[evt] ?? evt} ({configuredCount(evt)}/{data.channels.length} set)
              </option>
            ))}
          </select>
        </div>
        <p className="text-[11px] text-fg-muted pb-2">
          {EVENT_DESCRIPTIONS[eventType] ?? ''}
        </p>
      </div>

      {/* Channel sub-tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {data.channels.map(ch => {
          const has = data.templates.some(
            t => t.event_type === eventType && t.channel === ch
          );
          const active = channel === ch;
          return (
            <button
              key={ch}
              type="button"
              onClick={() => setChannel(ch)}
              className={`px-4 py-2 text-xs font-medium capitalize border-b-2 -mb-px transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? 'border-fg text-fg'
                  : 'border-transparent text-fg-muted hover:text-fg'
              }`}
            >
              {ch}
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ml-1.5 align-middle ${
                  has ? 'bg-emerald-500' : 'bg-border-strong'
                }`}
                title={has ? 'Configured' : 'Not configured'}
              />
            </button>
          );
        })}
        <span className="ml-auto pb-1">
          {current ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="outline">Not configured</Badge>
          )}
        </span>
      </div>

      {!current && (
        <p className="text-xs text-fg-muted italic">
          No template yet — messages for this event will not be sent on {channel}. Write
          one below or start from the default.
        </p>
      )}

      {/* Editor + preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          {channel === 'email' && (
            <input
              type="text"
              value={subject}
              onChange={e => {
                setSubject(e.target.value);
                setDirty(true);
              }}
              placeholder="Email subject"
              className="w-full text-sm bg-elevated border border-border rounded px-3 py-2 text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          )}
          <textarea
            ref={bodyRef}
            value={body}
            onChange={e => {
              setBody(e.target.value);
              setDirty(true);
            }}
            placeholder="Template body — use [variable] placeholders"
            className="w-full text-sm bg-elevated border border-border rounded px-3 py-2 text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring h-44 resize-none font-mono"
          />

          {vars.length > 0 && (
            <div>
              <p className="text-[11px] text-fg-muted mb-1">Click to insert:</p>
              <div className="flex flex-wrap gap-1">
                {vars.map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertPlaceholder(v)}
                    className="text-[10px] bg-sunken hover:bg-elevated text-fg-muted hover:text-fg px-1.5 py-0.5 rounded border border-border font-mono transition-colors"
                  >
                    [{v}]
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              disabled={saving}
              className="text-xs px-2 py-1.5 text-fg-muted hover:text-fg hover:bg-elevated rounded"
            >
              Reset to default
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty || !body.trim()}
              className="text-xs px-4 py-1.5 bg-fg text-canvas rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save template'}
            </button>
          </div>
        </div>

        {/* Preview */}
        <div>
          <p className="text-[11px] text-fg-muted mb-1">Preview with sample values</p>
          <div className="bg-surface border border-border rounded-lg p-3">
            {channel === 'email' && (
              <p className="text-xs text-fg font-medium border-b border-border pb-2 mb-2">
                {renderPreview(subject) || (
                  <span className="text-fg-subtle italic">No subject</span>
                )}
              </p>
            )}
            {body.trim() ? (
              <pre className="text-xs text-fg whitespace-pre-wrap font-sans">
                {renderPreview(body)}
              </pre>
            ) : (
              <p className="text-xs text-fg-subtle italic">
                Start typing to see the preview.
              </p>
            )}
          </div>
        </div>
      </div>

      {confirmReset && (
        <ConfirmDialog
          title="Reset to the default template?"
          description="This replaces the editor contents with the standard wording for this event. Nothing is saved until you click Save template."
          confirmLabel="Load default"
          onConfirm={applyDefault}
          onClose={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}
