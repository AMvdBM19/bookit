'use client';

import { useEffect, useState } from 'react';
import type { Catalog, CatalogStaff } from './catalog-loader';
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
  submitting: boolean;
  submitError: string | null;
  validationError: string | null;
  bookingResult: { bookingId: string; status: string; message: string } | null;
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
  submitting: false,
  submitError: null,
  validationError: null,
  bookingResult: null,
};

interface Props {
  slug: string;
  catalog: Catalog;
}

export default function BookingWidget({ slug, catalog }: Props) {
  const brandColor = catalog.settings?.brand_color ?? '#2BB673';
  const isAccountMode = catalog.tenant.client_mode === 'account';

  // Auto-select if only one staff member exists
  const initialStep: Step = catalog.staff.length === 1 ? 'datetime' : 'browse';
  const initialStaffId = catalog.staff.length === 1 ? catalog.staff[0].id : null;

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
      update({ validationError: 'Please select a time slot.' });
      return;
    }
    goTo('details');
  }

  function validateDetails(): string | null {
    if (isAccountMode) return 'Account mode requires login.';
    if (!state.guestName.trim()) return 'Name is required.';
    if (!state.guestEmail.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.guestEmail)) return 'Enter a valid email.';
    if (catalog.featureFlags.require_booking_notes && !state.bookingNotes.trim()) {
      return `${catalog.featureFlags.booking_notes_label} is required.`;
    }
    if (catalog.settings?.require_age_confirm && !state.ageConfirmed) {
      return `Please confirm you are at least ${catalog.settings.age_gate_minimum} years old.`;
    }
    return null;
  }

  function handleProceedToConfirm() {
    const err = validateDetails();
    if (err) {
      update({ validationError: err });
      return;
    }
    goTo('confirm');
  }

  async function handleSubmit() {
    if (!selectedStaff || !state.selectedDate || !state.selectedSlot) return;
    update({ submitting: true, submitError: null });

    try {
      const res = await fetch(`/book/${slug}/api/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: selectedStaff.id,
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
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        update({ submitting: false, submitError: data.error ?? 'Failed to book.' });
        return;
      }

      update({
        submitting: false,
        bookingResult: {
          bookingId: data.bookingId,
          status: data.status,
          message: data.message,
        },
        step: 'success',
      });
    } catch {
      update({ submitting: false, submitError: 'Network error. Please try again.' });
    }
  }

  function handleReset() {
    setState({
      ...INITIAL_STATE,
      step: catalog.staff.length === 1 ? 'datetime' : 'browse',
      selectedStaffId: catalog.staff.length === 1 ? catalog.staff[0].id : null,
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

  // Filter tags shown in details step to those offered by selected staff
  const staffTags = selectedStaff?.tags ?? [];
  const selectedTags = staffTags.filter(t => state.selectedTagIds.includes(t.id));

  return (
    <div className="min-h-screen bg-zinc-950 text-white px-4 py-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <header className="mb-6 flex items-center gap-3">
          {catalog.settings?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={catalog.settings.logo_url}
              alt={headerName}
              className="h-9 w-9 rounded-lg object-contain bg-zinc-900 p-1 border border-zinc-800"
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-white text-base font-semibold truncate">{headerName}</p>
            <p className="text-zinc-500 text-xs">Book a {bookingLabel.toLowerCase()}</p>
          </div>
        </header>

        {/* Step indicator */}
        {state.step !== 'success' && (
          <div className="flex items-center gap-1.5 mb-4">
            {(['browse', 'datetime', 'details', 'confirm'] as const).map((s, i) => {
              const order: Step[] = ['browse', 'datetime', 'details', 'confirm'];
              const currentIdx = order.indexOf(state.step);
              const active = i <= currentIdx;
              return (
                <div
                  key={s}
                  className="h-1 flex-1 rounded-full transition-colors"
                  style={{
                    backgroundColor: active ? brandColor : '#27272a',
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

          {state.step === 'datetime' && selectedStaff && (
            <>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                <p className="text-xs text-zinc-500">{catalog.terminology.staff}</p>
                <p className="text-sm text-white font-medium">{selectedStaff.pseudonym}</p>
              </div>
              <DateTimeSelect
                slug={slug}
                staffId={selectedStaff.id}
                selectedDate={state.selectedDate}
                selectedSlot={state.selectedSlot}
                onSelectDate={d => update({ selectedDate: d, selectedSlot: null })}
                onSelectSlot={handleSelectSlot}
                brandColor={brandColor}
              />
              {state.validationError && (
                <p className="text-red-400 text-xs">{state.validationError}</p>
              )}
              <div className="flex justify-between gap-2 pt-2">
                {catalog.staff.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => goTo('browse')}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs rounded-lg transition-colors"
                  >
                    Back
                  </button>
                ) : (
                  <div />
                )}
                <button
                  type="button"
                  onClick={handleProceedToDetails}
                  disabled={!state.selectedSlot}
                  className="px-6 py-2 bg-white text-zinc-900 text-xs font-medium rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {state.step === 'details' && selectedStaff && (
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
                }}
                onChange={u => update({ ...u, validationError: null })}
                brandColor={brandColor}
                validationError={state.validationError}
                durationMinutes={slotDurationMinutes()}
                basePriceLabel={catalog.terminology.base_price_label}
              />
              <div className="flex justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => goTo('datetime')}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs rounded-lg transition-colors"
                >
                  Back
                </button>
                {!isAccountMode && (
                  <button
                    type="button"
                    onClick={handleProceedToConfirm}
                    className="px-6 py-2 bg-white text-zinc-900 text-xs font-medium rounded-lg hover:bg-zinc-100 transition-colors"
                  >
                    Review
                  </button>
                )}
              </div>
            </>
          )}

          {state.step === 'confirm' &&
            selectedStaff &&
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
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
                  >
                    Back
                  </button>
                </div>
              </>
            )}

          {state.step === 'success' && state.bookingResult && selectedStaff && (
            <BookingSuccess
              status={state.bookingResult.status}
              message={state.bookingResult.message}
              bookingId={state.bookingResult.bookingId}
              bookingLabel={bookingLabel}
              staffName={selectedStaff.pseudonym}
              onBookAnother={handleReset}
              brandColor={brandColor}
            />
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-zinc-600 mt-8">
          Powered by Book-IT
        </p>
      </div>
    </div>
  );
}
