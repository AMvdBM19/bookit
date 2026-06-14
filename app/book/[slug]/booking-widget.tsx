'use client';

import { useEffect, useState } from 'react';
import type { Catalog, CatalogStaff } from './catalog-loader';
import {
  WidgetI18nProvider,
  getWidgetStrings,
  type WidgetLanguage,
} from '@/lib/widget-i18n';
import StaffBrowse from './steps/staff-browse';
import DateTimeSelect from './steps/datetime-select';
import DetailsForm from './steps/details-form';
import BookingConfirm from './steps/booking-confirm';
import BookingSuccess from './steps/booking-success';

type Step = 'browse' | 'datetime' | 'details' | 'confirm' | 'success';

interface BookingState {
  step: Step;
  selectedStaffId: string | null;
  selectedDate: string | null;
  selectedSlot: { start: string; end: string } | null;
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
  submitting: boolean;
  submitError: string | null;
  validationError: string | null;
  bookingResult: {
    bookingId: string;
    status: string;
    message: string;
    checkoutUrl?: string | null;
    depositAmount?: number | null;
  } | null;
}

const INITIAL_STATE: BookingState = {
  step: 'browse',
  selectedStaffId: null,
  selectedDate: null,
  selectedSlot: null,
  selectedTagIds: [],
  guestName: '',
  guestEmail: '',
  guestPhone: '',
  guestWaOptIn: false,
  bookingNotes: '',
  ageConfirmed: false,
  serviceAddress: '',
  referenceImagePath: null,
  referenceImagePreview: null,
  submitting: false,
  submitError: null,
  validationError: null,
  bookingResult: null,
};

interface Props {
  slug: string;
  catalog: Catalog;
  lang?: WidgetLanguage;
}

export default function BookingWidget({ slug, catalog, lang = 'en' }: Props) {
  return (
    <WidgetI18nProvider lang={lang}>
      <BookingWidgetInner slug={slug} catalog={catalog} lang={lang} />
    </WidgetI18nProvider>
  );
}

function BookingWidgetInner({ slug, catalog, lang }: Required<Props>) {
  const t = getWidgetStrings(lang);
  // All theme colors flow through CSS custom properties set by the layout —
  // inline styles reference the variable so live preview overrides apply.
  const brandColor = 'var(--w-primary)';
  const isAccountMode = catalog.tenant.client_mode === 'account';
  const showPoweredBy = catalog.settings?.widget_show_powered_by ?? true;

  // Pool mode: clients book without choosing staff — skip the browse step and
  // leave staff unselected; the booking is claimed by staff after submission.
  const isPool = catalog.featureFlags.booking_mode === 'pool';

  // Auto-select if only one staff member exists
  const initialStep: Step = isPool || catalog.staff.length === 1 ? 'datetime' : 'browse';
  const initialStaffId = !isPool && catalog.staff.length === 1 ? catalog.staff[0].id : null;

  const [state, setState] = useState<BookingState>({
    ...INITIAL_STATE,
    step: initialStep,
    selectedStaffId: initialStaffId,
  });

  // iframe resize: post height on step changes
  useEffect(() => {
    const postHeight = () => {
      try {
        const height = document.body.scrollHeight;
        window.parent.postMessage({ type: 'bookit:resize', height }, '*');
      } catch {
        /* ignore */
      }
    };
    postHeight();
    const id = window.setTimeout(postHeight, 50);
    return () => window.clearTimeout(id);
  }, [state.step, state.selectedDate, state.selectedSlot]);

  function update(updates: Partial<BookingState>) {
    setState(prev => ({ ...prev, ...updates }));
  }

  function goTo(step: Step) {
    update({ step, validationError: null, submitError: null });
  }

  const selectedStaff: CatalogStaff | null = state.selectedStaffId
    ? catalog.staff.find(s => s.id === state.selectedStaffId) ?? null
    : null;

  function handleSelectStaff(id: string) {
    update({ selectedStaffId: id, step: 'datetime' });
  }

  function handleSelectSlot(slot: { start: string; end: string }) {
    update({ selectedSlot: slot });
  }

  function handleProceedToDetails() {
    if (!state.selectedSlot) {
      update({ validationError: t.selectTimeSlot });
      return;
    }
    goTo('details');
  }

  function validateDetails(): string | null {
    if (isAccountMode) return t.accountModeError;
    if (!state.guestName.trim()) return t.nameRequired;
    if (!state.guestEmail.trim()) return t.emailRequired;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.guestEmail)) return t.emailInvalid;
    if (catalog.featureFlags.require_booking_notes && !state.bookingNotes.trim()) {
      return t.notesRequired(catalog.featureFlags.booking_notes_label);
    }
    if (catalog.settings?.require_age_confirm && !state.ageConfirmed) {
      return t.ageConfirmError(catalog.settings.age_gate_minimum);
    }
    if (catalog.featureFlags.booking_address_field && !state.serviceAddress.trim()) {
      return t.addressRequired;
    }
    return null;
  }

  function handleProceedToConfirm() {
    const err = validateDetails();
    if (err) {
      update({ validationError: err });
      return;
    }
    if (durationMismatch) {
      update({ validationError: t.durationChangedShort });
      return;
    }
    goTo('confirm');
  }

  async function handleSubmit() {
    if ((!selectedStaff && !isPool) || !state.selectedDate || !state.selectedSlot) return;
    update({ submitting: true, submitError: null });

    try {
      const res = await fetch(`/book/${slug}/api/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: selectedStaff?.id,
          slot_date: state.selectedDate,
          slot_start: state.selectedSlot.start,
          slot_end: state.selectedSlot.end,
          tag_ids: state.selectedTagIds,
          guest_name: state.guestName,
          guest_email: state.guestEmail,
          guest_phone: state.guestPhone || undefined,
          guest_wa_opt_in: state.guestWaOptIn,
          booking_notes: state.bookingNotes || undefined,
          age_confirmed: state.ageConfirmed,
          service_address: state.serviceAddress.trim() || undefined,
          reference_image_path: state.referenceImagePath || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Server error strings are English; for non-English chrome show the
        // localized generic failure instead of mixing languages.
        const serverError = lang === 'en' ? data.error : null;
        update({ submitting: false, submitError: serverError ?? t.bookingFailed });
        return;
      }

      update({
        submitting: false,
        bookingResult: {
          bookingId: data.bookingId,
          status: data.status,
          message: data.message,
          checkoutUrl: data.checkout_url ?? null,
          depositAmount: data.deposit_amount ?? null,
        },
        step: 'success',
      });
    } catch {
      update({ submitting: false, submitError: t.networkError });
    }
  }

  function handleReset() {
    setState({
      ...INITIAL_STATE,
      step: initialStep,
      selectedStaffId: initialStaffId,
    });
  }

  function slotDurationMinutes(): number {
    if (!state.selectedSlot) return 0;
    const [sh, sm] = state.selectedSlot.start.split(':').map(Number);
    const [eh, em] = state.selectedSlot.end.split(':').map(Number);
    return eh * 60 + em - (sh * 60 + sm);
  }

  const headerName =
    catalog.settings?.agency_display_name ?? catalog.tenant.name;
  const bookingLabel = catalog.terminology.booking;

  // Filter tags shown in details step to those offered by selected staff.
  // Pool mode has no selected staff — show all tenant tags.
  const staffTags = isPool
    ? catalog.tags.map(t => ({
        id: t.id,
        name: t.name,
        extra_price: t.extra_price ?? 0,
        duration_minutes: t.duration_minutes ?? null,
      }))
    : selectedStaff?.tags ?? [];
  const selectedTags = staffTags.filter(t => state.selectedTagIds.includes(t.id));

  // Per-service duration: selected services dictate the appointment length.
  // When the slot picked earlier no longer matches, the client must re-confirm.
  const perServiceDuration = catalog.settings?.per_service_duration_enabled ?? false;
  const defaultSlotMinutes = catalog.settings?.default_slot_minutes ?? 30;
  const effectiveDuration = (() => {
    if (!perServiceDuration) return defaultSlotMinutes;
    // NULL duration = a normal-length service: it contributes the default
    // slot length to the sum, not zero (must match the availability APIs).
    const total = selectedTags.reduce(
      (sum, t) => sum + (t.duration_minutes ?? defaultSlotMinutes),
      0
    );
    return total > 0 ? total : defaultSlotMinutes;
  })();
  const durationMismatch =
    perServiceDuration && state.selectedSlot !== null && effectiveDuration !== slotDurationMinutes();

  function handleReselectTime() {
    update({ selectedSlot: null, step: 'datetime', validationError: null });
  }

  const stepOrder: Step[] = isPool
    ? ['datetime', 'details', 'confirm']
    : ['browse', 'datetime', 'details', 'confirm'];

  return (
    <div className="min-h-screen px-4 py-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <header className="mb-6 flex items-center gap-3">
          {(catalog.settings?.widget_logo_url || catalog.settings?.logo_url) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={catalog.settings.widget_logo_url || catalog.settings.logo_url || ''}
              alt={headerName}
              className="h-9 w-9 w-round object-contain w-sf p-1 border w-bd"
            />
          ) : null}
          <div className="min-w-0">
            <p className="w-tx text-base font-semibold truncate">{headerName}</p>
            <p className="w-tx3 text-xs">{t.bookA(bookingLabel.toLowerCase())}</p>
          </div>
        </header>

        {/* Step indicator */}
        {state.step !== 'success' && (
          <div className="flex items-center gap-1.5 mb-4">
            {stepOrder.map((s, i) => {
              const currentIdx = stepOrder.indexOf(state.step);
              const active = i <= currentIdx;
              return (
                <div
                  key={s}
                  className="h-1 flex-1 rounded-full transition-colors"
                  style={{
                    backgroundColor: active ? brandColor : 'var(--w-border)',
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Step body */}
        <div className="space-y-4">
          {state.step === 'browse' && (
            <StaffBrowse
              staff={catalog.staff}
              staffLabel={catalog.terminology.staff}
              staffPluralLower={catalog.terminology.staff_plural.toLowerCase()}
              onSelect={handleSelectStaff}
              brandColor={brandColor}
              showPrice={catalog.settings?.show_price_to_client ?? false}
              currency={catalog.settings?.currency ?? 'EUR'}
            />
          )}

          {state.step === 'datetime' && (selectedStaff || isPool) && (
            <>
              {selectedStaff && (
                <div className="w-card w-pad-sm">
                  <p className="text-xs w-tx3">{catalog.terminology.staff}</p>
                  <p className="text-sm w-tx font-medium">{selectedStaff.pseudonym}</p>
                </div>
              )}
              <DateTimeSelect
                slug={slug}
                staffId={selectedStaff?.id ?? null}
                poolMode={isPool}
                poolTagIds={state.selectedTagIds}
                serviceTagIds={perServiceDuration ? state.selectedTagIds : []}
                selectedDate={state.selectedDate}
                selectedSlot={state.selectedSlot}
                onSelectDate={d => update({ selectedDate: d, selectedSlot: null })}
                onSelectSlot={handleSelectSlot}
                brandColor={brandColor}
                minLeadTimeHours={catalog.settings?.min_lead_time_hours ?? 0}
                maxBookingDaysAhead={catalog.settings?.max_booking_days_ahead ?? 30}
              />
              {state.validationError && (
                <p className="text-red-400 text-xs">{state.validationError}</p>
              )}
              <div className="flex justify-between gap-2 pt-2">
                {!isPool && catalog.staff.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => goTo('browse')}
                    className="px-4 py-2 w-btn2 text-xs w-round transition-colors"
                  >
                    {t.back}
                  </button>
                ) : (
                  <div />
                )}
                <button
                  type="button"
                  onClick={handleProceedToDetails}
                  disabled={!state.selectedSlot}
                  className="px-6 py-2 w-btn text-xs font-medium w-round transition-opacity disabled:opacity-50 focus:outline-none w-focus"
                >
                  {t.continue_}
                </button>
              </div>
            </>
          )}

          {state.step === 'details' && (selectedStaff || isPool) && (
            <>
              <DetailsForm
                slug={slug}
                clientMode={catalog.tenant.client_mode}
                featureFlags={catalog.featureFlags}
                settings={catalog.settings}
                staffTags={staffTags}
                state={{
                  selectedTagIds: state.selectedTagIds,
                  guestName: state.guestName,
                  guestEmail: state.guestEmail,
                  guestPhone: state.guestPhone,
                  guestWaOptIn: state.guestWaOptIn,
                  bookingNotes: state.bookingNotes,
                  ageConfirmed: state.ageConfirmed,
                  serviceAddress: state.serviceAddress,
                  referenceImagePath: state.referenceImagePath,
                  referenceImagePreview: state.referenceImagePreview,
                }}
                onChange={u => update({ ...u, validationError: null })}
                brandColor={brandColor}
                validationError={state.validationError}
                durationMinutes={slotDurationMinutes()}
                basePriceLabel={catalog.terminology.base_price_label}
              />
              {durationMismatch && (
                <div className="w-card w-pad-sm border border-amber-700/50">
                  <p className="text-xs text-amber-400">
                    {t.durationChangedTo(effectiveDuration)}
                  </p>
                  <button
                    type="button"
                    onClick={handleReselectTime}
                    className="mt-2 px-4 py-1.5 w-btn text-xs font-medium w-round transition-opacity"
                  >
                    {t.chooseNewTime}
                  </button>
                </div>
              )}
              <div className="flex justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => goTo('datetime')}
                  className="px-4 py-2 w-btn2 text-xs w-round transition-colors"
                >
                  {t.back}
                </button>
                {!isAccountMode && (
                  <button
                    type="button"
                    onClick={handleProceedToConfirm}
                    className="px-6 py-2 w-btn text-xs font-medium w-round transition-opacity"
                  >
                    {t.review}
                  </button>
                )}
              </div>
            </>
          )}

          {state.step === 'confirm' &&
            (selectedStaff || isPool) &&
            state.selectedDate &&
            state.selectedSlot && (
              <>
                <BookingConfirm
                  staff={selectedStaff}
                  date={state.selectedDate}
                  slot={state.selectedSlot}
                  selectedTags={selectedTags}
                  notes={state.bookingNotes}
                  settings={catalog.settings}
                  submitting={state.submitting}
                  submitError={state.submitError}
                  onSubmit={handleSubmit}
                  brandColor={brandColor}
                  isGuestMode={!isAccountMode}
                  depositsSupported={catalog.featureFlags.deposits_supported}
                  basePriceLabel={catalog.terminology.base_price_label}
                />
                <div className="flex justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => goTo('details')}
                    disabled={state.submitting}
                    className="px-4 py-2 w-btn2 text-xs w-round transition-colors disabled:opacity-50"
                  >
                    {t.back}
                  </button>
                </div>
              </>
            )}

          {state.step === 'success' && state.bookingResult && (
            <BookingSuccess
              status={state.bookingResult.status}
              message={state.bookingResult.message}
              bookingId={state.bookingResult.bookingId}
              bookingLabel={bookingLabel}
              staffName={selectedStaff?.pseudonym ?? 'Our team'}
              onBookAnother={handleReset}
              brandColor={brandColor}
              checkoutUrl={state.bookingResult.checkoutUrl ?? null}
              depositAmount={state.bookingResult.depositAmount ?? null}
              currency={catalog.settings?.currency ?? 'EUR'}
            />
          )}
        </div>

        {/* Footer */}
        {showPoweredBy && (
          <p className="text-center text-[10px] w-tx3 mt-8">
            {t.poweredBy}
          </p>
        )}
      </div>
    </div>
  );
}
