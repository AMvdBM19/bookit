'use client';

import { useState } from 'react';
import Spinner from '@/components/ui/spinner';
import type { CatalogSettings, CatalogStaff } from '../catalog-loader';
import { formatWidgetMoney } from '@/lib/widget-i18n';
import { useWidgetStrings } from '@/lib/widget-i18n-context';

interface Tag {
  id: string;
  name: string;
  description?: string | null;
  extra_price: number;
  allow_quantity?: boolean | null;
}

interface Props {
  staff: CatalogStaff | null;
  date: string;
  slot: { start: string; end: string };
  selectedTags: Tag[];
  /** Per-tag quantities for allow_quantity tags (tag_id → count). */
  tagQuantities?: Record<string, number>;
  notes: string;
  settings: CatalogSettings | null;
  submitting: boolean;
  submitError: string | null;
  onSubmit: (opts?: { termsAcceptedAt?: string }) => void;
  brandColor: string;
  isGuestMode: boolean;
  depositsSupported: boolean;
  basePriceLabel: string;
  requireTermsAcceptance?: boolean;
  termsUrl?: string | null;
  privacyUrl?: string | null;
}

function formatDate(dateStr: string, locale: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(locale, {
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
  tagQuantities = {},
  notes,
  settings,
  submitting,
  submitError,
  onSubmit,
  brandColor,
  isGuestMode,
  depositsSupported,
  basePriceLabel,
  requireTermsAcceptance = false,
  termsUrl,
  privacyUrl,
}: Props) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const t = useWidgetStrings();
  const showPrice = settings?.show_price_to_client ?? false;
  const baseRate = settings?.base_rate_per_30min ?? 60;
  const currency = settings?.currency ?? 'EUR';
  const duration = durationMinutes(slot.start, slot.end);
  const slots30 = duration / 30;
  const baseTotal = baseRate * slots30;
  const qtyOf = (tag: Tag) => (tag.allow_quantity ? (tagQuantities[tag.id] ?? 1) : 1);
  const tagExtrasTotal = selectedTags.reduce((sum, t) => sum + (t.extra_price ?? 0) * qtyOf(t), 0);
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
          <span className="text-xs w-tx3">{t.with_}</span>
          <span className="text-xs w-tx">{staff?.pseudonym ?? t.toBeAssigned}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-xs w-tx3">{t.date}</span>
          <span className="text-xs w-tx">{formatDate(date, t.locale)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-xs w-tx3">{t.time}</span>
          <span className="text-xs w-tx">
            {slot.start}–{slot.end} ({formatDuration(duration)})
          </span>
        </div>
        {selectedTags.length > 0 && (
          <div>
            <p className="text-xs w-tx3 mb-1">{t.services}</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedTags.map(tag => {
                const q = qtyOf(tag);
                return (
                  <span
                    key={tag.id}
                    title={tag.description ?? undefined}
                    className="w-el border w-bd2 rounded-full px-2 py-0.5 text-[11px] w-tx-soft"
                  >
                    {tag.name}{q > 1 ? ` ×${q}` : ''}
                  </span>
                );
              })}
            </div>
          </div>
        )}
        {notes && (
          <div>
            <p className="text-xs w-tx3 mb-1">{t.notes}</p>
            <p className="text-xs w-tx-soft whitespace-pre-wrap">{notes}</p>
          </div>
        )}
      </section>

      {showPrice && (
        <section className="w-card w-pad space-y-1.5">
          <div className="flex justify-between gap-4">
            <span className="text-xs w-tx3">
              {basePriceLabel} ({formatDuration(duration)})
            </span>
            <span className="text-xs w-tx">
              {formatWidgetMoney(baseTotal, currency, t)}
            </span>
          </div>
          {selectedTags.filter(tag => tag.extra_price > 0).map(tag => {
            const q = qtyOf(tag);
            return (
              <div key={tag.id} className="flex justify-between gap-4">
                <span className="text-xs w-tx3">{tag.name}{q > 1 ? ` ×${q}` : ''}</span>
                <span className="text-xs w-tx">
                  +{formatWidgetMoney((tag.extra_price ?? 0) * q, currency, t)}
                </span>
              </div>
            );
          })}
          <div className="flex justify-between gap-4 pt-1.5 border-t w-bd">
            <span className="text-sm w-tx font-medium">{t.total}</span>
            <span className="text-sm w-tx font-medium">
              {formatWidgetMoney(totalPrice, currency, t)}
            </span>
          </div>
          {depositApplies && (
            <div className="flex justify-between gap-4 pt-1 text-amber-400">
              <span className="text-xs">{t.depositRequiredLine(depositPct)}</span>
              <span className="text-xs font-medium">{formatWidgetMoney(depositAmount, currency, t)}</span>
            </div>
          )}
        </section>
      )}

      {depositApplies && (
        <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 p-3 text-xs text-amber-300">
          {t.depositNotice(formatWidgetMoney(depositAmount, currency, t), depositPct)}
        </div>
      )}

      {requireTermsAcceptance && (
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={e => setTermsAccepted(e.target.checked)}
            className="mt-0.5 accent-[var(--w-primary)]"
          />
          <span className="text-xs w-tx-soft">
            I agree to the{' '}
            {termsUrl ? (
              <a href={termsUrl} target="_blank" rel="noopener noreferrer" className="underline w-tx">
                terms &amp; conditions
              </a>
            ) : (
              'terms & conditions'
            )}
            {privacyUrl && (
              <>
                {' '}and{' '}
                <a href={privacyUrl} target="_blank" rel="noopener noreferrer" className="underline w-tx">
                  privacy policy
                </a>
              </>
            )}
          </span>
        </label>
      )}

      {submitError && <p className="text-red-400 text-xs">{submitError}</p>}

      <button
        type="button"
        onClick={() => onSubmit(requireTermsAcceptance && termsAccepted ? { termsAcceptedAt: new Date().toISOString() } : undefined)}
        disabled={submitting || (requireTermsAcceptance && !termsAccepted)}
        className="w-full w-round py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 focus:outline-none w-focus inline-flex items-center justify-center gap-2"
        style={{ backgroundColor: brandColor, color: '#fff' }}
      >
        {submitting && <Spinner size="sm" />}
        {submitting ? t.submitting : t.submitBooking}
      </button>

      {!requireTermsAcceptance && privacyUrl && (
        <p className="text-[10px] w-tx3 text-center">
          <a href={privacyUrl} target="_blank" rel="noopener noreferrer" className="underline">
            Privacy policy
          </a>
        </p>
      )}

      {isGuestMode && (
        <p className="text-[10px] w-tx3 text-center">
          {t.trustLine}
        </p>
      )}
    </div>
  );
}
