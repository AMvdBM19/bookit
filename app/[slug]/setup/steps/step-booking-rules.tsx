'use client';

import type { WizardState } from '../wizard-shell';

interface Props {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
  error?: string;
}

const inputCls =
  'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500';
const labelCls = 'block text-xs text-zinc-400 mb-1';

const SLOT_OPTIONS = [15, 30, 45, 60, 90, 120];

export default function StepBookingRules({ state, onChange, error }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls} htmlFor="default_slot_minutes">
          Default Slot Duration <span className="text-red-400">*</span>
        </label>
        <select
          id="default_slot_minutes"
          value={state.default_slot_minutes}
          onChange={e => onChange({ default_slot_minutes: Number(e.target.value) })}
          className={inputCls}
        >
          {SLOT_OPTIONS.map(m => (
            <option key={m} value={m}>
              {m >= 60 ? `${m / 60}h${m % 60 ? ` ${m % 60}min` : ''}` : `${m} min`}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-zinc-700 hover:border-zinc-600 p-3 cursor-pointer transition-colors">
        <input
          type="checkbox"
          checked={state.per_service_duration_enabled}
          onChange={e => onChange({ per_service_duration_enabled: e.target.checked })}
          className="mt-0.5 accent-white"
        />
        <div>
          <p className="text-sm text-white">Services have different durations</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Each service can set its own appointment length later (Pricing tab). Off
            = every booking uses the default slot duration.
          </p>
        </div>
      </label>

      <div>
        <label className={labelCls} htmlFor="min_lead_time_hours">
          Minimum Lead Time (hours) <span className="text-red-400">*</span>
        </label>
        <input
          id="min_lead_time_hours"
          type="number"
          min={0}
          max={72}
          value={state.min_lead_time_hours}
          onChange={e => onChange({ min_lead_time_hours: Number(e.target.value) })}
          className={inputCls}
        />
        <p className="text-xs text-zinc-600 mt-1">
          How many hours in advance a booking must be made. 0 = same-day allowed.
        </p>
      </div>

      <div>
        <label className={labelCls}>
          Booking Confirmation Mode <span className="text-red-400">*</span>
        </label>
        <div className="space-y-2 mt-1">
          {[
            {
              value: 'staff_must_accept',
              label: 'Staff must accept',
              desc: 'Each booking request requires manual approval.',
            },
            {
              value: 'auto_confirm',
              label: 'Auto-confirm',
              desc: 'Bookings in available slots are confirmed immediately.',
            },
          ].map(opt => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                state.booking_confirm_mode === opt.value
                  ? 'border-white bg-zinc-800'
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <input
                type="radio"
                name="booking_confirm_mode"
                value={opt.value}
                checked={state.booking_confirm_mode === opt.value}
                onChange={() =>
                  onChange({
                    booking_confirm_mode: opt.value as WizardState['booking_confirm_mode'],
                  })
                }
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
