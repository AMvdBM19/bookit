'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useTenantConfig } from '@/lib/context/tenant-config';
import Modal from '@/components/ui/modal';
import Spinner from '@/components/ui/spinner';
import ConfirmDialog from '@/components/ui/confirm-dialog';

interface TagOption {
  id: string;
  name: string;
  extra_price: number | null;
}

interface EditContext {
  booking: {
    id: string;
    status: string;
    duration_minutes: number;
    booking_notes: string | null;
    total_price: number | string | null;
    tag_ids: string[];
  };
  tags: TagOption[];
  settings: {
    base_rate_per_30min: number | string | null;
    currency: string | null;
  } | null;
  editable: boolean;
  editable_reason: string | null;
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: currency || 'EUR',
    }).format(amount);
  } catch {
    return `${currency || 'EUR'} ${amount.toFixed(2)}`;
  }
}

/**
 * Edit modal for an existing booking: service tags, notes, and the total
 * price (auto-recomputed from base rate + extras unless overridden). Used
 * by the agent Bookings tab and, when staff_can_edit_bookings is on, the
 * staff dashboard. Server enforces roles and the editable-status window.
 */
export default function EditBookingModal({
  slug,
  bookingId,
  onClose,
  onSaved,
}: {
  slug: string;
  bookingId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { terminology } = useTenantConfig();
  const [ctx, setCtx] = useState<EditContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [price, setPrice] = useState('');
  const [priceTouched, setPriceTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmPrice, setConfirmPrice] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/${slug}/bookings/${bookingId}/edit`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(data.error ?? 'Failed to load booking');
          return;
        }
        setCtx(data);
        setSelected(new Set(data.booking.tag_ids ?? []));
        setNotes(data.booking.booking_notes ?? '');
        setPrice(
          data.booking.total_price != null ? String(round2(num(data.booking.total_price))) : ''
        );
      } catch {
        if (!cancelled) setLoadError('Network error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, bookingId]);

  const currency = ctx?.settings?.currency ?? 'EUR';
  const baseRate = num(ctx?.settings?.base_rate_per_30min);
  const duration = ctx?.booking.duration_minutes ?? 0;

  const computedTotal = useMemo(() => {
    if (!ctx) return 0;
    const extras = ctx.tags
      .filter(t => selected.has(t.id))
      .reduce((sum, t) => sum + num(t.extra_price), 0);
    return round2(baseRate * (duration / 30) + extras);
  }, [ctx, selected, baseRate, duration]);

  // Keep the price synced to the computation until the user overrides it.
  useEffect(() => {
    if (!priceTouched && ctx) setPrice(String(computedTotal));
  }, [computedTotal, priceTouched, ctx]);

  const originalPrice = ctx ? round2(num(ctx.booking.total_price)) : 0;
  const nextPrice = round2(num(price));
  const priceChanged = ctx !== null && nextPrice !== originalPrice;

  function toggleTag(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function requestSave() {
    if (priceChanged) {
      setConfirmPrice(true);
    } else {
      save();
    }
  }

  async function save() {
    setConfirmPrice(false);
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        tag_ids: Array.from(selected),
        booking_notes: notes,
      };
      // Only send an override when the user diverged from the computation.
      if (nextPrice !== computedTotal) body.total_price = nextPrice;

      const res = await fetch(`/api/${slug}/bookings/${bookingId}/edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't save changes. Please try again.");
        return;
      }
      toast.success(data.unchanged ? 'No changes to save.' : `${terminology.booking} updated.`);
      onSaved();
    } catch {
      toast.error("Couldn't save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Edit ${terminology.booking}`} onClose={onClose}>
      {loadError ? (
        <p className="text-sm text-red-500">{loadError}</p>
      ) : !ctx ? (
        <div className="flex justify-center py-10 text-fg-muted">
          <Spinner size="md" />
        </div>
      ) : !ctx.editable ? (
        <p className="text-sm text-fg-muted">{ctx.editable_reason}</p>
      ) : (
        <div className="space-y-4">
          {ctx.tags.length > 0 && (
            <div>
              <p className="block text-xs text-fg-muted mb-1">{terminology.service_tag}</p>
              <div className="space-y-1.5">
                {ctx.tags.map(t => (
                  <label key={t.id} className="flex items-center gap-2 cursor-pointer text-sm text-fg">
                    <input
                      type="checkbox"
                      checked={selected.has(t.id)}
                      onChange={() => toggleTag(t.id)}
                      className="accent-fg"
                    />
                    <span className="flex-1">{t.name}</span>
                    {num(t.extra_price) > 0 && (
                      <span className="text-xs text-fg-muted">
                        +{money(num(t.extra_price), currency)}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-fg-muted mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              maxLength={1000}
              className="w-full text-sm bg-elevated text-fg border border-border rounded px-3 py-2 h-20 resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs text-fg-muted mb-1">Total price ({currency})</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={e => {
                setPrice(e.target.value);
                setPriceTouched(true);
              }}
              className="w-full text-sm bg-elevated text-fg border border-border rounded px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-[11px] text-fg-muted mt-1">
              Computed from base rate + services: {money(computedTotal, currency)}
              {priceTouched && nextPrice !== computedTotal && ' (overridden)'}
              {' · '}was {money(originalPrice, currency)}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="text-sm px-3 py-1.5 text-fg hover:bg-elevated rounded"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={requestSave}
              disabled={saving}
              className="text-sm px-4 py-1.5 bg-fg text-canvas rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      {confirmPrice && ctx && (
        <ConfirmDialog
          title="Change the price?"
          description={`The total changes from ${money(originalPrice, currency)} to ${money(nextPrice, currency)}. The ${terminology.client.toLowerCase()} is not notified automatically.`}
          confirmLabel="Save with new price"
          onConfirm={save}
          onClose={() => setConfirmPrice(false)}
        />
      )}
    </Modal>
  );
}
