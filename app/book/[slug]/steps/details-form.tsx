'use client';

import type { CatalogSettings } from '../catalog-loader';
import type { FeatureFlags } from '@/lib/types/tenant-config';

interface Tag {
  id: string;
  name: string;
  extra_price: number;
}

interface State {
  selectedTagIds: string[];
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestWaOptIn: boolean;
  bookingNotes: string;
  ageConfirmed: boolean;
}

interface Props {
  slug: string;
  clientMode: 'guest' | 'account';
  featureFlags: FeatureFlags;
  settings: CatalogSettings | null;
  staffTags: Tag[];
  state: State;
  onChange: (updates: Partial<State>) => void;
  brandColor: string;
  validationError: string | null;
  durationMinutes: number;
  basePriceLabel: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€', USD: '$', GBP: '£',
};

const inputCls =
  'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500';
const labelCls = 'block text-xs text-zinc-400 mb-1';

export default function DetailsForm({
  slug,
  clientMode,
  featureFlags,
  settings,
  staffTags,
  state,
  onChange,
  brandColor,
  validationError,
  durationMinutes,
  basePriceLabel,
}: Props) {
  const showPrice = settings?.show_price_to_client ?? false;
  const sym = CURRENCY_SYMBOLS[settings?.currency ?? 'EUR'] ?? settings?.currency ?? 'EUR';

  function toggleTag(tagId: string) {
    const next = state.selectedTagIds.includes(tagId)
      ? state.selectedTagIds.filter(id => id !== tagId)
      : [...state.selectedTagIds, tagId];
    onChange({ selectedTagIds: next });
  }

  if (clientMode === 'account') {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-white text-sm font-medium mb-2">Account required</p>
          <p className="text-zinc-400 text-xs">
            This business requires an account to book. Please{' '}
            <a
              href={`/${slug}/login?redirect=/book/${slug}`}
              target="_top"
              className="underline hover:text-white"
              style={{ color: brandColor }}
            >
              log in
            </a>{' '}
            or contact the business directly.
          </p>
        </div>
      </div>
    );
  }

  const requireAge = settings?.require_age_confirm ?? false;
  const ageMin = settings?.age_gate_minimum ?? 18;

  return (
    <div className="space-y-4">
      {staffTags.length > 0 && (
        <div>
          <p className={labelCls}>What would you like?</p>
          <div className="flex flex-wrap gap-2">
            {staffTags.map(tag => {
              const selected = state.selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    selected
                      ? 'text-white border-transparent'
                      : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-500'
                  }`}
                  style={selected ? { backgroundColor: brandColor } : undefined}
                >
                  {tag.name}
                  {showPrice && tag.extra_price > 0 && (
                    <span className={selected ? 'opacity-75 ml-1' : 'text-zinc-500 ml-1'}>
                      +{sym}{tag.extra_price}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showPrice && durationMinutes > 0 && (() => {
        const baseRate = settings?.base_rate_per_30min ?? 0;
        const slots30 = durationMinutes / 30;
        const baseTotal = baseRate * slots30;
        const selectedExtras = staffTags.filter(t => state.selectedTagIds.includes(t.id));
        const extrasTotal = selectedExtras.reduce((sum, t) => sum + (t.extra_price ?? 0), 0);
        const subtotal = baseTotal + extrasTotal;
        return (
          <div className="rounded-lg border border-zinc-800 bg-zinc-800 p-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">{basePriceLabel}</span>
              <span className="text-zinc-300">{sym}{baseTotal.toFixed(2)}</span>
            </div>
            {selectedExtras.map(t => (
              <div key={t.id} className="flex justify-between text-xs">
                <span className="text-zinc-400">{t.name}</span>
                <span className="text-zinc-300">+{sym}{t.extra_price.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm pt-1.5 border-t border-zinc-700">
              <span className="text-white font-medium">Subtotal</span>
              <span className="font-medium" style={{ color: brandColor }}>{sym}{subtotal.toFixed(2)}</span>
            </div>
          </div>
        );
      })()}

      <div>
        <label className={labelCls} htmlFor="bookingNotes">
          {featureFlags.booking_notes_label}{' '}
          {featureFlags.require_booking_notes && <span className="text-red-400">*</span>}
        </label>
        <textarea
          id="bookingNotes"
          value={state.bookingNotes}
          onChange={e => onChange({ bookingNotes: e.target.value })}
          className={inputCls + ' h-24 resize-none'}
          placeholder={featureFlags.booking_notes_placeholder ?? ''}
          maxLength={1000}
        />
      </div>

      <div>
        <label className={labelCls} htmlFor="guestName">
          Your name <span className="text-red-400">*</span>
        </label>
        <input
          id="guestName"
          type="text"
          value={state.guestName}
          onChange={e => onChange({ guestName: e.target.value })}
          className={inputCls}
          placeholder="Full name"
          autoComplete="name"
          required
        />
      </div>

      <div>
        <label className={labelCls} htmlFor="guestEmail">
          Email <span className="text-red-400">*</span>
        </label>
        <input
          id="guestEmail"
          type="email"
          value={state.guestEmail}
          onChange={e => onChange({ guestEmail: e.target.value })}
          className={inputCls}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </div>

      <div>
        <label className={labelCls} htmlFor="guestPhone">
          Phone <span className="text-zinc-600">(optional)</span>
        </label>
        <input
          id="guestPhone"
          type="tel"
          value={state.guestPhone}
          onChange={e => onChange({ guestPhone: e.target.value })}
          className={inputCls}
          placeholder="+31..."
          autoComplete="tel"
        />
      </div>

      {state.guestPhone && (
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={state.guestWaOptIn}
            onChange={e => onChange({ guestWaOptIn: e.target.checked })}
            className="mt-0.5 accent-white"
          />
          <span className="text-xs text-zinc-400">
            I&apos;d like to receive WhatsApp updates about my booking.
          </span>
        </label>
      )}

      {requireAge && (
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={state.ageConfirmed}
            onChange={e => onChange({ ageConfirmed: e.target.checked })}
            className="mt-0.5 accent-white"
          />
          <span className="text-xs text-zinc-400">
            I confirm I am at least {ageMin} years old.
          </span>
        </label>
      )}

      {validationError && (
        <p className="text-red-400 text-xs">{validationError}</p>
      )}
    </div>
  );
}
