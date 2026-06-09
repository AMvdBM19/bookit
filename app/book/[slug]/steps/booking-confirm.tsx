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
  staff: CatalogStaff | null;
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
  basePriceLabel: string;
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
  basePriceLabel,
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
      <section className="w-card w-pad space-y-2">
        <div className="flex justify-between gap-4">
          <span className="text-xs w-tx3">With</span>
          <span className="text-xs w-tx">{staff?.pseudonym ?? 'To be assigned'}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-xs w-tx3">Date</span>
          <span className="text-xs w-tx">{formatDate(date)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-xs w-tx3">Time</span>
          <span className="text-xs w-tx">
            {slot.start}–{slot.end} ({formatDuration(duration)})
          </span>
        </div>
        {selectedTags.length > 0 && (
          <div>
            <p className="text-xs w-tx3 mb-1">Services</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedTags.map(t => (
                <span
                  key={t.id}
                  className="w-el border w-bd2 rounded-full px-2 py-0.5 text-[11px] w-tx-soft"
                >
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        )}
        {notes && (
          <div>
            <p className="text-xs w-tx3 mb-1">Notes</p>
            <p className="text-xs w-tx-soft whitespace-pre-wrap">{notes}</p>
          </div>
        )}
      </section>

      {showPrice && (() => {
        const sym = CURRENCY_SYMBOLS[currency] ?? currency;
        return (
          <section className="w-card w-pad space-y-1.5">
            <div className="flex justify-between gap-4">
              <span className="text-xs w-tx3">
                {basePriceLabel} ({formatDuration(duration)})
              </span>
              <span className="text-xs w-tx">
                {sym}{baseTotal.toFixed(2)}
              </span>
            </div>
            {selectedTags.filter(t => t.extra_price > 0).map(t => (
              <div key={t.id} className="flex justify-between gap-4">
                <span className="text-xs w-tx3">{t.name}</span>
                <span className="text-xs w-tx">
                  +{sym}{t.extra_price.toFixed(2)}
                </span>
              </div>
            ))}
            <div className="flex justify-between gap-4 pt-1.5 border-t w-bd">
              <span className="text-sm w-tx font-medium">Total</span>
              <span className="text-sm w-tx font-medium">
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
        className="w-full w-round py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 focus:outline-none w-focus"
        style={{ backgroundColor: brandColor, color: '#fff' }}
      >
        {submitting ? 'Submitting…' : 'Submit Booking'}
      </button>

      {isGuestMode && (
        <p className="text-[10px] w-tx3 text-center">
          Your details are not stored without your consent.
        </p>
      )}
    </div>
  );
}
