'use client';

import { useRef, useState } from 'react';
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
  serviceAddress: string;
  referenceImagePath: string | null;
  referenceImagePreview: string | null;
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

const inputCls = 'w-full w-input px-3 py-2 text-sm';
const labelCls = 'block text-xs w-tx2 mb-1';

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
  const [uploadingRef, setUploadingRef] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);
  const refFileInput = useRef<HTMLInputElement>(null);

  async function handleReferenceFile(file: File) {
    setRefError(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setRefError('Only JPEG, PNG or WebP images are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setRefError('Image must be 5 MB or smaller.');
      return;
    }
    setUploadingRef(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/book/${slug}/api/reference-upload`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRefError(data.error ?? 'Upload failed. Please try again.');
        return;
      }
      onChange({
        referenceImagePath: data.path,
        referenceImagePreview: URL.createObjectURL(file),
      });
    } catch {
      setRefError('Upload failed. Please try again.');
    } finally {
      setUploadingRef(false);
      if (refFileInput.current) refFileInput.current.value = '';
    }
  }

  function toggleTag(tagId: string) {
    const next = state.selectedTagIds.includes(tagId)
      ? state.selectedTagIds.filter(id => id !== tagId)
      : [...state.selectedTagIds, tagId];
    onChange({ selectedTagIds: next });
  }

  if (clientMode === 'account') {
    return (
      <div className="space-y-4">
        <div className="w-card w-pad text-center">
          <p className="w-tx text-sm font-medium mb-2">Account required</p>
          <p className="w-tx2 text-xs">
            This business requires an account to book. Please{' '}
            <a
              href={`/${slug}/login?redirect=/book/${slug}`}
              target="_top"
              className="underline hover:opacity-80"
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
                      : 'w-el w-tx-soft w-bd2 w-hbd'
                  }`}
                  style={selected ? { backgroundColor: brandColor } : undefined}
                >
                  {tag.name}
                  {showPrice && tag.extra_price > 0 && (
                    <span className={selected ? 'opacity-75 ml-1' : 'w-tx3 ml-1'}>
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
          <div className="w-round border w-bd w-el w-pad-sm space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="w-tx2">{basePriceLabel}</span>
              <span className="w-tx-soft">{sym}{baseTotal.toFixed(2)}</span>
            </div>
            {selectedExtras.map(t => (
              <div key={t.id} className="flex justify-between text-xs">
                <span className="w-tx2">{t.name}</span>
                <span className="w-tx-soft">+{sym}{t.extra_price.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm pt-1.5 border-t w-bd2">
              <span className="w-tx font-medium">Subtotal</span>
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

      {featureFlags.booking_reference_image && (
        <div>
          <label className={labelCls} htmlFor="referenceImage">
            Reference image <span className="w-tx3">(optional)</span>
          </label>
          {state.referenceImagePath && state.referenceImagePreview ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={state.referenceImagePreview}
                alt="Reference"
                className="w-16 h-16 w-round object-cover border w-bd"
              />
              <button
                type="button"
                onClick={() =>
                  onChange({ referenceImagePath: null, referenceImagePreview: null })
                }
                className="px-3 py-1.5 w-btn2 text-xs w-round transition-colors"
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <input
                ref={refFileInput}
                id="referenceImage"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleReferenceFile(file);
                }}
              />
              <button
                type="button"
                onClick={() => refFileInput.current?.click()}
                disabled={uploadingRef}
                className="px-4 py-2 w-btn2 text-xs w-round transition-colors disabled:opacity-50"
              >
                {uploadingRef ? 'Uploading…' : 'Upload an image'}
              </button>
              <p className="text-[11px] w-tx3 mt-1">
                Show us what you have in mind. JPEG, PNG or WebP, max 5 MB.
              </p>
            </>
          )}
          {refError && <p className="text-red-400 text-xs mt-1">{refError}</p>}
        </div>
      )}

      {featureFlags.booking_address_field && (
        <div>
          <label className={labelCls} htmlFor="serviceAddress">
            Service address <span className="text-red-400">*</span>
          </label>
          <input
            id="serviceAddress"
            type="text"
            value={state.serviceAddress}
            onChange={e => onChange({ serviceAddress: e.target.value })}
            className={inputCls}
            placeholder="Street, number, city"
            autoComplete="street-address"
            maxLength={500}
            required
          />
        </div>
      )}

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
          Phone <span className="w-tx3">(optional)</span>
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
            className="mt-0.5"
          />
          <span className="text-xs w-tx2">
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
            className="mt-0.5"
          />
          <span className="text-xs w-tx2">
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
