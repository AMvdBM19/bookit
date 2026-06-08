'use client';

import type { CatalogSettings, CatalogStaff } from '../catalog-loader';

interface Tag {
  id: string;
  name: string;
  extra_price: number;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€', USD: '$', GBP: '£',
};

interface Props {
  staff: CatalogStaff;
  date: string;
  slot: { start: string; end: string };
  selectedTags: Tag[];
  notes: string;
  settings: CatalogSettings | null;
  submitting: boolean;
  submitError: string | null;
  onSubmit: () => void;
  brandColor: string;
  isGuestMode: boolean;
  depositsSupported: boolean;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function durationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

function formatDuration(mins: number): string {
  if (mins >= 60 && mins % 60 === 0) return `${mins / 60}h`;
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}min`;
  return `${mins} min`;
}

export default function BookingConfirm({
  staff,
  date,
  slot,
  selectedTags,
  notes,
  settings,
  submitting,
  submitError,
  onSubmit,
  brandColor,
  isGuestMode,
  depositsSupported,
}: Props) {
  const showPrice = settings?.show_price_to_client ?? false;
  const baseRate = settings?.base_rate_per_30min ?? 60;
  const currency = settings?.currency ?? 'EUR';
  const duration = durationMinutes(slot.start, slot.end);
  const slots30 = duration / 30;
  const baseTotal = baseRate * slots30;
  const tagExtrasTotal = selectedTags.reduce((sum, t) => sum + (t.extra_price ?? 0), 0);
  const totalPrice = baseTotal + tagExtrasTotal;

  const depositPct = settings?.deposit_pct ?? 0;
  const depositThreshold = settings?.deposit_required_above_minutes ?? 0;
  const depositApplies =
    depositsSupported &&
    depositPct > 0 &&
    duration > depositThreshold;
  const depositAmount = depositApplies ? totalPrice * (depositPct / 100) : 0;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-2">
        <div className="flex justify-between gap-4">
          <span className="text-xs text-zinc-500">With</span>
          <span className="text-xs text-white">{staff.pseudonym}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-xs text-zinc-500">Date</span>
          <span className="text-xs text-white">{formatDate(date)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-xs text-zinc-500">Time</span>
          <span className="text-xs text-white">
            {slot.start}–{slot.end} ({formatDuration(duration)})
          </span>
        </div>
        {selectedTags.length > 0 && (
          <div>
            <p className="text-xs text-zinc-500 mb-1">Services</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedTags.map(t => (
                <span
                  key={t.id}
                  className="bg-zinc-800 border border-zinc-700 rounded-full px-2 py-0.5 text-[11px] text-zinc-300"
                >
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        )}
        {notes && (
          <div>
            <p className="text-xs text-zinc-500 mb-1">Notes</p>
            <p className="text-xs text-zinc-300 whitespace-pre-wrap">{notes}</p>
          </div>
        )}
      </section>

      {showPrice && (() => {
        const sym = CURRENCY_SYMBOLS[currency] ?? currency;
        return (
          <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-1.5">
            <div className="flex justify-between gap-4">
              <span className="text-xs text-zinc-500">
                Base booking ({formatDuration(duration)})
              </span>
              <span className="text-xs text-white">
                {sym}{baseTotal.toFixed(2)}
              </span>
            </div>
            {selectedTags.filter(t => t.extra_price > 0).map(t => (
              <div key={t.id} className="flex justify-between gap-4">
                <span className="text-xs text-zinc-500">{t.name}</span>
                <span className="text-xs text-white">
                  +{sym}{t.extra_price.toFixed(2)}
                </span>
              </div>
            ))}
            <div className="flex justify-between gap-4 pt-1.5 border-t border-zinc-800">
              <span className="text-sm text-white font-medium">Total</span>
              <span className="text-sm text-white font-medium">
                {sym}{totalPrice.toFixed(2)}
              </span>
            </div>
            {depositApplies && (
              <div className="flex justify-between gap-4 pt-1 text-amber-400">
                <span className="text-xs">Deposit required ({depositPct}%)</span>
                <span className="text-xs font-medium">{sym}{depositAmount.toFixed(2)}</span>
              </div>
            )}
          </section>
        );
      })()}

      {depositApplies && (
        <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 p-3 text-xs text-amber-300">
          A deposit of {CURRENCY_SYMBOLS[currency] ?? currency}{depositAmount.toFixed(2)} ({depositPct}%) is required to
          confirm this booking. Payment link will be sent after confirmation.
        </div>
      )}

      {submitError && <p className="text-red-400 text-xs">{submitError}</p>}

      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        className="w-full rounded-lg py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: brandColor, color: '#fff' }}
      >
        {submitting ? 'Submitting…' : 'Submit Booking'}
      </button>

      {isGuestMode && (
        <p className="text-[10px] text-zinc-600 text-center">
          Your details are not stored without your consent.
        </p>
      )}
    </div>
  );
}
