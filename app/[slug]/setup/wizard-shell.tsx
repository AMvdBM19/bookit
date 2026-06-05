'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTenantConfig } from '@/lib/context/tenant-config';
import type { ComplianceFlags, FeatureFlags, Terminology } from '@/lib/types/tenant-config';
import StepTemplatePicker from './steps/step-template-picker';
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

function buildDefaultState(
  featureFlags: FeatureFlags,
  tenantName: string,
  initialServiceTags: string[]
): WizardState {
  return {
    agency_display_name: tenantName,
    kvk_number: '',
    license_number: '',
    brand_color: '#2BB673',
    logo_url: '',
    default_slot_minutes: 30,
    min_lead_time_hours: 2,
    booking_confirm_mode: 'staff_must_accept',
    base_rate_per_30min: 60,
    staff_payout_pct: 70,
    currency: 'EUR',
    tax_rate_pct: 21,
    tax_label: 'BTW',
    age_gate_minimum: featureFlags.age_gate_minimum ?? 18,
    require_age_confirm: featureFlags.show_age_gate_step,
    require_id_upload: false,
    service_tags: [...initialServiceTags],
  };
}

type StepKey =
  | 'template'
  | 'identity'
  | 'branding'
  | 'booking'
  | 'financial'
  | 'compliance'
  | 'services'
  | 'review';

function stepLabel(key: StepKey, terminology: Terminology): string {
  switch (key) {
    case 'template':
      return 'Industry';
    case 'identity':
      return 'Identity';
    case 'branding':
      return 'Branding';
    case 'booking':
      return 'Booking Rules';
    case 'financial':
      return 'Financial';
    case 'compliance':
      return 'Compliance';
    case 'services':
      return terminology.service_tag;
    case 'review':
      return 'Review & Launch';
  }
}

function validateStep(
  key: StepKey,
  state: WizardState,
  complianceFlags: ComplianceFlags,
  featureFlags: FeatureFlags
): string | null {
  switch (key) {
    case 'identity':
      if (!state.agency_display_name.trim()) return 'Name is required.';
      if (complianceFlags.show_kvk_field && !state.kvk_number.trim())
        return 'KVK number is required.';
      if (complianceFlags.show_license_field && !state.license_number.trim())
        return 'License number is required.';
      return null;
    case 'branding':
      if (!state.brand_color.match(/^#[0-9a-fA-F]{6}$/))
        return 'Enter a valid hex color (e.g. #2BB673).';
      return null;
    case 'booking':
      if (state.min_lead_time_hours < 0) return 'Lead time cannot be negative.';
      return null;
    case 'financial':
      if (state.base_rate_per_30min < 0) return 'Base rate cannot be negative.';
      if (state.staff_payout_pct < 0 || state.staff_payout_pct > 100)
        return 'Payout % must be between 0 and 100.';
      if (!state.tax_label.trim()) return 'Tax label is required.';
      return null;
    case 'compliance':
      if (featureFlags.show_age_gate_step && state.age_gate_minimum < 18)
        return 'Minimum age must be at least 18.';
      return null;
    case 'services':
      if (state.service_tags.length === 0) return 'At least one option is required.';
      return null;
    default:
      return null;
  }
}

interface Props {
  slug: string;
  tenantName: string;
  initialServiceTags: string[];
}

export default function WizardShell({ slug, tenantName, initialServiceTags }: Props) {
  const router = useRouter();
  const { terminology, featureFlags, complianceFlags, sourceTemplateSlug } = useTenantConfig();

  const steps = useMemo<StepKey[]>(() => {
    const s: StepKey[] = [];
    if (!sourceTemplateSlug) s.push('template');
    s.push('identity', 'branding', 'booking', 'financial');

    const hasAnyCompliance = Object.values(complianceFlags).some(v => v === true);
    const hasAgeGate = featureFlags.show_age_gate_step;
    if (hasAnyCompliance || hasAgeGate) s.push('compliance');

    s.push('services', 'review');
    return s;
  }, [complianceFlags, featureFlags, sourceTemplateSlug]);

  const [currentStep, setCurrentStep] = useState(0);
  const [state, setState] = useState<WizardState>(() =>
    buildDefaultState(featureFlags, tenantName, initialServiceTags)
  );
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Guard against the step array shrinking (e.g. after template selection removes
  // the template step) leaving currentStep out of range.
  const safeStep = Math.min(currentStep, steps.length - 1);
  const stepKey = steps[safeStep];

  function update(updates: Partial<WizardState>) {
    setState(prev => ({ ...prev, ...updates }));
    setStepError(null);
  }

  function handleNext() {
    const err = validateStep(stepKey, state, complianceFlags, featureFlags);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    setCurrentStep(s => Math.min(s + 1, steps.length - 1));
  }

  function handleBack() {
    setStepError(null);
    setCurrentStep(s => Math.max(s - 1, 0));
  }

  // The template picker stamps tenant_config server-side; refreshing re-runs the
  // layout server component so the provider picks up the new config and the
  // template step drops out of the array (currentStep 0 then points to Identity).
  function handleTemplateSelected() {
    setCurrentStep(0);
    router.refresh();
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

  const stepProps = { state, onChange: update, error: stepError ?? undefined };
  const isLastStep = safeStep === steps.length - 1;

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center px-4 py-10">
      {/* Header */}
      <div className="w-full max-w-lg mb-6 text-center">
        <h1 className="text-white text-xl font-semibold">Set up your account</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Step {safeStep + 1} of {steps.length} — {stepLabel(stepKey, terminology)}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-lg mb-6">
        <div className="h-1.5 bg-zinc-800 rounded-full">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${((safeStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-lg bg-zinc-900 rounded-xl border border-zinc-800 p-6 shadow-lg">
        <h2 className="text-white font-medium mb-4">{stepLabel(stepKey, terminology)}</h2>

        {stepKey === 'template' && (
          <StepTemplatePicker slug={slug} onSelected={handleTemplateSelected} />
        )}
        {stepKey === 'identity' && <StepIdentity {...stepProps} />}
        {stepKey === 'branding' && <StepBranding {...stepProps} />}
        {stepKey === 'booking' && <StepBookingRules {...stepProps} />}
        {stepKey === 'financial' && <StepFinancial {...stepProps} />}
        {stepKey === 'compliance' && <StepCompliance {...stepProps} />}
        {stepKey === 'services' && <StepServices {...stepProps} />}
        {stepKey === 'review' && <StepReview state={state} error={submitError ?? undefined} />}

        {stepKey !== 'template' && (
          <div className="flex justify-between mt-6 gap-3">
            {safeStep > 0 ? (
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

            {!isLastStep ? (
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
        )}
      </div>
    </div>
  );
}
