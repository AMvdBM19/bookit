'use client';

import type { StaffWizardState } from '../wizard-shell';

interface Props {
  state: StaffWizardState;
  onChange: (updates: Partial<StaffWizardState>) => void;
  error?: string;
}

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const inputCls =
  'bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-zinc-500 disabled:opacity-40';

export default function StepSchedule({ state, onChange, error }: Props) {
  function updateDay(dayOfWeek: number, updates: Partial<StaffWizardState['schedule'][number]>) {
    const next = state.schedule.map(d =>
      d.day_of_week === dayOfWeek ? { ...d, ...updates } : d
    );
    onChange({ schedule: next });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        Set your weekly availability. Enable at least one day. Times use 24h format.
      </p>

      <div className="space-y-2">
        {DISPLAY_ORDER.map(dow => {
          const day = state.schedule.find(d => d.day_of_week === dow)!;
          return (
            <div
              key={dow}
              className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                day.enabled ? 'border-zinc-600 bg-zinc-800/50' : 'border-zinc-800'
              }`}
            >
              <label className="flex items-center gap-2 w-28 shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={e => updateDay(dow, { enabled: e.target.checked })}
                  className="accent-white"
                />
                <span className={`text-sm ${day.enabled ? 'text-white' : 'text-zinc-600'}`}>
                  {DAY_LABELS[dow]}
                </span>
              </label>

              <input
                type="time"
                value={day.start_time}
                onChange={e => updateDay(dow, { start_time: e.target.value })}
                disabled={!day.enabled}
                className={inputCls + ' w-28'}
              />
              <span className="text-zinc-500 text-xs">to</span>
              <input
                type="time"
                value={day.end_time}
                onChange={e => updateDay(dow, { end_time: e.target.value })}
                disabled={!day.enabled}
                className={inputCls + ' w-28'}
              />
            </div>
          );
        })}
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
