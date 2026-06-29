'use client';

import { useRef, useState } from 'react';
import type { CatalogSettings } from '../catalog-loader';
import type { FeatureFlags } from '@/lib/types/tenant-config';
import type { BookingField } from '@/lib/types/booking-fields';
import { formatWidgetMoney } from '@/lib/widget-i18n';
import { useWidgetStrings } from '@/lib/widget-i18n-context';

interface Tag {
  id: string;
  name: string;
  description?: string | null;
  extra_price: number;
  duration_minutes?: number | null;
  blocks_slot?: boolean | null;
  allow_quantity?: boolean | null;
  max_quantity?: number | null;
}

interface State {
  selectedTagIds: string[];
  selectedTagQuantities: Record<string, number>;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestWaOptIn: boolean;
  bookingNotes: string;
  ageConfirmed: boolean;
  /** Custom booking-field values keyed by field_key (Phase 20-C). */
  customFieldValues: Record<string, string | string[]>;
  /** Object-URL previews for file fields, keyed by field_key. */
  customFieldPreviews: Record<string, string>;
}

interface Props {
  slug: string;
  clientMode: 'guest' | 'account';
  featureFlags: FeatureFlags;
  settings: CatalogSettings | null;
  staffTags: Tag[];
  bookingFields: BookingField[];
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
  bookingFields,
  state,
  onChange,
  brandColor,
  validationError,
  durationMinutes,
  basePriceLabel,
}: Props) {
  const t = useWidgetStrings();
  const showPrice = settings?.show_price_to_client ?? false;
  const sym = CURRENCY_SYMBOLS[settings?.currency ?? 'EUR'] ?? settings?.currency ?? 'EUR';
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  function setFieldValue(key: string, value: string | string[]) {
    onChange({ customFieldValues: { ...state.customFieldValues, [key]: value } });
  }

  async function handleFileUpload(field: BookingField, file: File) {
    setFileErrors(prev => ({ ...prev, [field.field_key]: '' }));
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setFileErrors(prev => ({ ...prev, [field.field_key]: t.referenceImageTypeError }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileErrors(prev => ({ ...prev, [field.field_key]: t.referenceImageSizeError }));
      return;
    }
    setUploadingKey(field.field_key);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/book/${slug}/api/reference-upload`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFileErrors(prev => ({
          ...prev,
          [field.field_key]: (t.locale === 'en-GB' ? data.error : null) ?? t.referenceImageUploadError,
        }));
        return;
      }
      onChange({
        customFieldValues: { ...state.customFieldValues, [field.field_key]: data.path },
        customFieldPreviews: { ...state.customFieldPreviews, [field.field_key]: URL.createObjectURL(file) },
      });
    } catch {
      setFileErrors(prev => ({ ...prev, [field.field_key]: t.referenceImageUploadError }));
    } finally {
      setUploadingKey(null);
      const input = fileInputs.current[field.field_key];
      if (input) input.value = '';
    }
  }

  function toggleTag(tagId: string) {
    const next = state.selectedTagIds.includes(tagId)
      ? state.selectedTagIds.filter(id => id !== tagId)
      : [...state.selectedTagIds, tagId];
    onChange({ selectedTagIds: next });
  }

  // Quantity steppers: changing a quantity to 0 deselects the tag; raising it
  // from 0 selects it. Quantity is clamped to [1, max_quantity].
  function setQuantity(tag: Tag, qty: number) {
    const max = Math.max(1, tag.max_quantity ?? 1);
    const clamped = Math.max(0, Math.min(max, Math.floor(qty)));
    const quantities = { ...state.selectedTagQuantities };
    let ids = state.selectedTagIds;
    if (clamped <= 0) {
      delete quantities[tag.id];
      ids = ids.filter(id => id !== tag.id);
    } else {
      quantities[tag.id] = clamped;
      if (!ids.includes(tag.id)) ids = [...ids, tag.id];
    }
    onChange({ selectedTagIds: ids, selectedTagQuantities: quantities });
  }

  if (clientMode === 'account') {
    return (
      <div className="space-y-4">
        <div className="w-card w-pad text-center">
          <p className="w-tx text-sm font-medium mb-2">{t.accountRequiredTitle}</p>
          <p className="w-tx2 text-xs">
            {t.accountRequiredBefore}{' '}
            <a
              href={`/${slug}/login?redirect=/book/${slug}`}
              target="_top"
              className="underline hover:opacity-80"
              style={{ color: brandColor }}
            >
              {t.accountRequiredLogin}
            </a>{' '}
            {t.accountRequiredAfter}
          </p>
        </div>
      </div>
    );
  }

  const requireAge = settings?.require_age_confirm ?? false;
  const ageMin = settings?.age_gate_minimum ?? 18;

  // --w-* themed renderer for one tenant-defined custom field.
  function renderCustomField(field: BookingField) {
    const key = field.field_key;
    const value = state.customFieldValues[key];
    const required = field.required;
    const labelEl = (
      <label className={labelCls} htmlFor={`cf-${key}`}>
        {field.label}{' '}
        {required ? (
          <span className="text-red-400">*</span>
        ) : (
          <span className="w-tx3">{t.optionalSuffix}</span>
        )}
      </label>
    );
    const help = field.help_text ? (
      <p className="text-[11px] w-tx3 mt-1">{field.help_text}</p>
    ) : null;
    const options = field.options ?? [];

    switch (field.field_type) {
      case 'textarea':
        return (
          <div key={key}>
            {labelEl}
            <textarea
              id={`cf-${key}`}
              value={typeof value === 'string' ? value : ''}
              onChange={e => setFieldValue(key, e.target.value)}
              className={inputCls + ' h-24 resize-none'}
              placeholder={field.placeholder ?? ''}
              maxLength={2000}
              required={required}
            />
            {help}
          </div>
        );
      case 'date':
        return (
          <div key={key}>
            {labelEl}
            <input
              id={`cf-${key}`}
              type="date"
              value={typeof value === 'string' ? value : ''}
              onChange={e => setFieldValue(key, e.target.value)}
              className={inputCls}
              required={required}
            />
            {help}
          </div>
        );
      case 'select':
        return (
          <div key={key}>
            {labelEl}
            <select
              id={`cf-${key}`}
              value={typeof value === 'string' ? value : ''}
              onChange={e => setFieldValue(key, e.target.value)}
              className={inputCls}
              required={required}
            >
              <option value="">{field.placeholder ?? '—'}</option>
              {options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {help}
          </div>
        );
      case 'radio':
        return (
          <div key={key}>
            {labelEl}
            <div className="space-y-1.5">
              {options.map(opt => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer text-xs w-tx2">
                  <input
                    type="radio"
                    name={`cf-${key}`}
                    checked={value === opt}
                    onChange={() => setFieldValue(key, opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
            {help}
          </div>
        );
      case 'checkbox': {
        const arr = Array.isArray(value) ? value : [];
        return (
          <div key={key}>
            {labelEl}
            <div className="space-y-1.5">
              {options.map(opt => {
                const checked = arr.includes(opt);
                return (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer text-xs w-tx2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setFieldValue(
                          key,
                          checked ? arr.filter(o => o !== opt) : [...arr, opt]
                        )
                      }
                    />
                    {opt}
                  </label>
                );
              })}
            </div>
            {help}
          </div>
        );
      }
      case 'file': {
        const path = typeof value === 'string' ? value : '';
        const preview = state.customFieldPreviews[key];
        const err = fileErrors[key];
        return (
          <div key={key}>
            {labelEl}
            {path && preview ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt={field.label} className="w-16 h-16 w-round object-cover border w-bd" />
                <button
                  type="button"
                  onClick={() => {
                    const nextValues = { ...state.customFieldValues };
                    delete nextValues[key];
                    const nextPreviews = { ...state.customFieldPreviews };
                    delete nextPreviews[key];
                    onChange({ customFieldValues: nextValues, customFieldPreviews: nextPreviews });
                  }}
                  className="px-3 py-1.5 w-btn2 text-xs w-round transition-colors"
                >
                  {t.referenceImageRemove}
                </button>
              </div>
            ) : (
              <>
                <input
                  ref={el => {
                    fileInputs.current[key] = el;
                  }}
                  id={`cf-${key}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(field, file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputs.current[key]?.click()}
                  disabled={uploadingKey === key}
                  className="px-4 py-2 w-btn2 text-xs w-round transition-colors disabled:opacity-50"
                >
                  {uploadingKey === key ? t.referenceImageUploading : t.referenceImageUpload}
                </button>
                <p className="text-[11px] w-tx3 mt-1">{field.help_text ?? t.referenceImageHint}</p>
              </>
            )}
            {err && <p className="text-red-400 text-xs mt-1">{err}</p>}
          </div>
        );
      }
      case 'address':
      case 'text':
      default:
        return (
          <div key={key}>
            {labelEl}
            <input
              id={`cf-${key}`}
              type="text"
              value={typeof value === 'string' ? value : ''}
              onChange={e => setFieldValue(key, e.target.value)}
              className={inputCls}
              placeholder={field.placeholder ?? ''}
              autoComplete={field.field_type === 'address' ? 'street-address' : undefined}
              maxLength={500}
              required={required}
            />
            {help}
          </div>
        );
    }
  }

  return (
    <div className="space-y-4">
      {staffTags.length > 0 && (() => {
        const chipTags = staffTags.filter(tag => !tag.allow_quantity);
        const qtyTags = staffTags.filter(tag => tag.allow_quantity);
        return (
          <div className="space-y-3">
            <p className={labelCls}>{t.whatWouldYouLike}</p>

            {chipTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {chipTags.map(tag => {
                  const selected = state.selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      title={tag.description ?? undefined}
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
            )}

            {/* Per-chip descriptions (chips can't wrap helper text). */}
            {chipTags.some(tag => tag.description) && (
              <div className="space-y-0.5">
                {chipTags
                  .filter(tag => tag.description)
                  .map(tag => (
                    <p key={tag.id} className="text-[11px] w-tx3">
                      <span className="w-tx2">{tag.name}:</span> {tag.description}
                    </p>
                  ))}
              </div>
            )}

            {qtyTags.map(tag => {
              const qty = state.selectedTagQuantities[tag.id] ?? 0;
              const max = Math.max(1, tag.max_quantity ?? 1);
              return (
                <div
                  key={tag.id}
                  className="flex items-center justify-between gap-3 w-round border w-bd w-el w-pad-sm"
                >
                  <div className="min-w-0">
                    <p className="text-xs w-tx-soft">
                      {tag.name}
                      {showPrice && tag.extra_price > 0 && (
                        <span className="w-tx3 ml-1">+{sym}{tag.extra_price} {t.each}</span>
                      )}
                    </p>
                    {tag.description && (
                      <p className="text-[11px] w-tx3">{tag.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setQuantity(tag, qty - 1)}
                      disabled={qty <= 0}
                      aria-label={t.decrease}
                      className="w-round border w-bd w-sf w-hbd w-tx-soft w-7 h-7 flex items-center justify-center text-sm disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none w-focus"
                    >
                      −
                    </button>
                    <span className="text-sm w-tx font-medium w-6 text-center tabular-nums">{qty}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity(tag, qty + 1)}
                      disabled={qty >= max}
                      aria-label={t.increase}
                      className="w-round border w-bd w-sf w-hbd w-tx-soft w-7 h-7 flex items-center justify-center text-sm disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none w-focus"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {showPrice && durationMinutes > 0 && (() => {
        const baseRate = settings?.base_rate_per_30min ?? 0;
        const slots30 = durationMinutes / 30;
        const baseTotal = baseRate * slots30;
        const selectedExtras = staffTags
          .filter(t => state.selectedTagIds.includes(t.id))
          .map(t => ({ ...t, qty: t.allow_quantity ? (state.selectedTagQuantities[t.id] ?? 1) : 1 }));
        const extrasTotal = selectedExtras.reduce((sum, t) => sum + (t.extra_price ?? 0) * t.qty, 0);
        const subtotal = baseTotal + extrasTotal;
        const currency = settings?.currency ?? 'EUR';
        return (
          <div className="w-round border w-bd w-el w-pad-sm space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="w-tx2">{basePriceLabel}</span>
              <span className="w-tx-soft">{formatWidgetMoney(baseTotal, currency, t)}</span>
            </div>
            {selectedExtras.map(tag => (
              <div key={tag.id} className="flex justify-between text-xs">
                <span className="w-tx2">{tag.name}{tag.qty > 1 ? ` ×${tag.qty}` : ''}</span>
                <span className="w-tx-soft">+{formatWidgetMoney((tag.extra_price ?? 0) * tag.qty, currency, t)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm pt-1.5 border-t w-bd2">
              <span className="w-tx font-medium">{t.subtotal}</span>
              <span className="font-medium" style={{ color: brandColor }}>{formatWidgetMoney(subtotal, currency, t)}</span>
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

      {/* Tenant-defined custom booking fields (Phase 20-C) */}
      {bookingFields.map(renderCustomField)}

      <div>
        <label className={labelCls} htmlFor="guestName">
          {t.yourName} <span className="text-red-400">*</span>
        </label>
        <input
          id="guestName"
          type="text"
          value={state.guestName}
          onChange={e => onChange({ guestName: e.target.value })}
          className={inputCls}
          placeholder={t.fullNamePlaceholder}
          autoComplete="name"
          required
        />
      </div>

      <div>
        <label className={labelCls} htmlFor="guestEmail">
          {t.email} <span className="text-red-400">*</span>
        </label>
        <input
          id="guestEmail"
          type="email"
          value={state.guestEmail}
          onChange={e => onChange({ guestEmail: e.target.value })}
          className={inputCls}
          placeholder={t.emailPlaceholder}
          autoComplete="email"
          required
        />
      </div>

      <div>
        <label className={labelCls} htmlFor="guestPhone">
          {t.phone} <span className="w-tx3">{t.optionalSuffix}</span>
        </label>
        <input
          id="guestPhone"
          type="tel"
          value={state.guestPhone}
          onChange={e => onChange({ guestPhone: e.target.value })}
          className={inputCls}
          placeholder={t.phonePlaceholder}
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
            {t.waOptIn}
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
            {t.ageConfirm(ageMin)}
          </span>
        </label>
      )}

      {validationError && (
        <p className="text-red-400 text-xs">{validationError}</p>
      )}
    </div>
  );
}
