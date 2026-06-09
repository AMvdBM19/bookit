'use client';

import { useTenantConfig } from '@/lib/context/tenant-config';
import type { WizardState } from '../wizard-shell';

interface Props {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
  error?: string;
}

export default function StepBookingMode({ state, onChange, error }: Props) {
  const { terminology } = useTenantConfig();
  const staffLower = terminology.staff.toLowerCase();
  const staffPluralLower = terminology.staff_plural.toLowerCase();
  const bookingLower = terminology.booking.toLowerCase();
  const bookingPlural = terminology.booking_plural;

  const options = [
    {
      value: 'staff_select' as const,
      label: `Client selects a specific ${staffLower}`,
      desc: `Each ${bookingLower} is assigned to the chosen ${staffLower}.`,
    },
    {
      value: 'pool' as const,
      label: `Any available ${staffLower}`,
      desc: `${bookingPlural} go to all available ${staffPluralLower}. The first to accept gets the ${bookingLower}.`,
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-zinc-400 mb-1">
          How do your clients choose a {staffLower}? <span className="text-red-400">*</span>
        </label>
        <div className="space-y-2 mt-1">
          {options.map(opt => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                state.booking_mode === opt.value
                  ? 'border-white bg-zinc-800'
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <input
                type="radio"
                name="booking_mode"
                value={opt.value}
                checked={state.booking_mode === opt.value}
                onChange={() => onChange({ booking_mode: opt.value })}
                className="mt-0.5 accent-white"
              />
              <div>
                <p className="text-sm text-white">{opt.label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
