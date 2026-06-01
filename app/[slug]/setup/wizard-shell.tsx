'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { VerticalConfig } from '@/lib/verticals/types';
import StepIdentity from './steps/step-identity';
import StepBranding from './steps/step-branding';
import StepBookingRules from './steps/step-booking-rules';
import StepFinancial from './steps/step-financial';
import StepCompliance from './steps/step-compliance';
import StepServices from './steps/step-services';
import StepReview from './steps/step-review';

export interface WizardState {
  agency_display_name: string;
  kvk_number: string;
  license_number: string;
  brand_color: string;
  logo_url: string;
  default_slot_minutes: number;
  min_lead_time_hours: number;
  booking_confirm_mode: 'staff_must_accept' | 'auto_confirm';
  base_rate_per_30min: number;
  staff_payout_pct: number;
  currency: string;
  tax_rate_pct: number;
  tax_label: string;
  age_gate_minimum: number;
  require_age_confirm: boolean;
  require_id_upload: boolean;
  service_tags: string[];
}

function buildDefaultState(config: VerticalConfig, tenantName: string): WizardState {
  return {
    agency_display_name: tenantName,
    kvk_number: '',
    license_number: '',
    brand_color: '#2BB673',
    logo_url: '',
    default_slot_minutes: config.defaults.default_slot_minutes,
    min_lead_time_hours: 2,
    booking_confirm_mode: config.defaults.booking_confirm_mode,
    base_rate_per_30min: 60,
    staff_payout_pct: 70,
    currency: 'EUR',
    tax_rate_pct: 21,
    tax_label: 'BTW',
    age_gate_minimum: config.defaults.age_gate_minimum ?? 18,
    require_age_confirm: config.defaults.require_age_confirm,
    require_id_upload: false,
    service_tags: [...config.seed_tags],
  };
}

const TOTAL_STEPS = 7;

function getStepLabel(step: number, config: VerticalConfig): string {
  const isAdult = config.id === 'adult_services';
  switch (step) {
    case 1:
      return isAdult ? 'Agency Identity' : 'Studio Identity';
    case 2:
      return 'Branding';
    case 3:
      return 'Booking Rules';
    case 4:
      return 'Financial';
    case 5:
      return isAdult ? 'Compliance' : 'Age Gate';
    case 6:
      return config.terminology.service_plural;
    case 7:
      return 'Review & Launch';
    default:
      return '';
  }
}

function validateStep(step: number, state: WizardState, config: VerticalConfig): string | null {
  switch (step) {
    case 1:
      if (!state.agency_display_name.trim()) return 'Name is required.';
      if (config.show_kvk_field && !state.kvk_number.trim()) return 'KVK number is required.';
      if (config.show_license_field && !state.license_number.trim()) return 'License number is required.';
      return null;
    case 2:
      if (!state.brand_color.match(/^#[0-9a-fA-F]{6}$/)) return 'Enter a valid hex color (e.g. #2BB673).';
      return null;
    case 3:
      if (state.min_lead_time_hours < 0) return 'Lead time cannot be negative.';
      return null;
    case 4:
      if (state.base_rate_per_30min < 0) return 'Base rate cannot be negative.';
      if (state.staff_payout_pct < 0 || state.staff_payout_pct > 100) return 'Payout % must be between 0 and 100.';
      if (!state.tax_label.trim()) return 'Tax label is required.';
      return null;
    case 5:
      if (state.age_gate_minimum < 18) return 'Minimum age must be at least 18.';
      return null;
    case 6:
      if (state.service_tags.length === 0) return `At least one ${config.terminology.service_tag.toLowerCase()} is required.`;
      return null;
    default:
      return null;
  }
}

interface Props {
  slug: string;
  tenantName: string;
  config: VerticalConfig;
}

export default function WizardShell({ slug, tenantName, config }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(() => buildDefaultState(config, tenantName));
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function update(updates: Partial<WizardState>) {
    setState(prev => ({ ...prev, ...updates }));
    setStepError(null);
  }

  function handleNext() {
    const err = validateStep(step, state, config);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    setStep(s => Math.min(s + 1, TOTAL_STEPS));
  }

  function handleBack() {
    setStepError(null);
    setStep(s => Math.max(s - 1, 1));
  }

  async function handleLaunch() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/${slug}/setup/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }
      router.push(`/${slug}/dashboard`);
      router.refresh();
    } catch {
      setSubmitError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const stepProps = { state, onChange: update, config, error: stepError ?? undefined };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center px-4 py-10">
      {/* Header */}
      <div className="w-full max-w-lg mb-8 text-center">
        <h1 className="text-white text-xl font-semibold">Set up your account</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Step {step} of {TOTAL_STEPS} — {getStepLabel(step, config)}
        </p>
      </div>

      {/* Step indicator */}
      <div className="w-full max-w-lg mb-6">
        <div className="flex items-center justify-between">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => {
            const n = i + 1;
            const done = n < step;
            const current = n === step;
            return (
              <div key={n} className="flex flex-col items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                    current
                      ? 'bg-white text-zinc-900'
                      : done
                      ? 'bg-zinc-600 text-white'
                      : 'bg-zinc-800 text-zinc-600'
                  }`}
                >
                  {done ? '✓' : n}
                </div>
                <span className="text-[10px] text-zinc-600 hidden sm:block">
                  {getStepLabel(n, config)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="relative mt-2 h-px bg-zinc-800">
          <div
            className="absolute inset-y-0 left-0 bg-zinc-500 transition-all"
            style={{ width: `${((step - 1) / (TOTAL_STEPS - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-lg bg-zinc-900 rounded-xl border border-zinc-800 p-6 shadow-lg">
        <h2 className="text-white font-medium mb-4">{getStepLabel(step, config)}</h2>

        {step === 1 && <StepIdentity {...stepProps} />}
        {step === 2 && <StepBranding {...stepProps} />}
        {step === 3 && <StepBookingRules {...stepProps} />}
        {step === 4 && <StepFinancial {...stepProps} />}
        {step === 5 && <StepCompliance {...stepProps} />}
        {step === 6 && <StepServices {...stepProps} />}
        {step === 7 && <StepReview state={state} config={config} error={submitError ?? undefined} />}

        <div className="flex justify-between mt-6 gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2 bg-white text-zinc-900 text-sm font-medium rounded-lg hover:bg-zinc-100 transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLaunch}
              disabled={submitting}
              className="px-6 py-2 bg-white text-zinc-900 text-sm font-medium rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Launching…' : 'Launch'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
