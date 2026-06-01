'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { VerticalConfig } from '@/lib/verticals/types';
import StepProfile from './steps/step-profile';
import StepServiceTags from './steps/step-service-tags';
import StepSchedule from './steps/step-schedule';
import StepReview from './steps/step-review';

export interface StaffWizardState {
  pseudonym: string;
  bio: string;
  languages: string[];
  social_links: {
    instagram: string;
    tiktok: string;
    facebook: string;
    x: string;
    website: string;
  };
  gender: string;
  nationality: string;
  age: number | null;
  selected_tag_ids: string[];
  schedule: Array<{
    day_of_week: number;
    enabled: boolean;
    start_time: string;
    end_time: string;
  }>;
}

const TOTAL_STEPS = 4;

function getStepLabel(step: number, config: VerticalConfig): string {
  switch (step) {
    case 1:
      return 'Profile';
    case 2:
      return config.terminology.service_plural;
    case 3:
      return 'Schedule';
    case 4:
      return 'Review';
    default:
      return '';
  }
}

function validateStep(
  step: number,
  state: StaffWizardState,
  config: VerticalConfig
): string | null {
  switch (step) {
    case 1:
      if (config.staff_require_pseudonym && !state.pseudonym.trim())
        return `${config.id === 'adult_services' ? 'Pseudonym' : 'Display name'} is required.`;
      if (state.age !== null && state.age < 18) return 'Age must be at least 18.';
      return null;
    case 2:
      if (state.selected_tag_ids.length === 0)
        return `Select at least one ${config.terminology.service_tag.toLowerCase()}.`;
      return null;
    case 3: {
      const enabled = state.schedule.filter(d => d.enabled);
      if (enabled.length === 0) return 'Enable at least one day.';
      for (const d of enabled) {
        if (d.start_time >= d.end_time)
          return `Start time must be before end time on ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.day_of_week]}.`;
      }
      return null;
    }
    default:
      return null;
  }
}

interface Props {
  slug: string;
  staffId: string;
  initialState: StaffWizardState;
  availableTags: Array<{ id: string; name: string }>;
  config: VerticalConfig;
}

export default function StaffWizardShell({
  slug,
  staffId,
  initialState,
  availableTags,
  config,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<StaffWizardState>(initialState);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function update(updates: Partial<StaffWizardState>) {
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

  async function handleSave() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/${slug}/staff-setup/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...state, staffId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? 'Something went wrong.');
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
      <div className="w-full max-w-lg mb-8 text-center">
        <h1 className="text-white text-xl font-semibold">Complete your profile</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Step {step} of {TOTAL_STEPS} — {getStepLabel(step, config)}
        </p>
      </div>

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

      <div className="w-full max-w-lg bg-zinc-900 rounded-xl border border-zinc-800 p-6 shadow-lg">
        <h2 className="text-white font-medium mb-4">{getStepLabel(step, config)}</h2>

        {step === 1 && <StepProfile {...stepProps} />}
        {step === 2 && (
          <StepServiceTags {...stepProps} availableTags={availableTags} />
        )}
        {step === 3 && <StepSchedule state={state} onChange={update} error={stepError ?? undefined} />}
        {step === 4 && (
          <StepReview
            state={state}
            config={config}
            availableTags={availableTags}
            error={submitError ?? undefined}
          />
        )}

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
              onClick={handleSave}
              disabled={submitting}
              className="px-6 py-2 bg-white text-zinc-900 text-sm font-medium rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Save & Go Live'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
