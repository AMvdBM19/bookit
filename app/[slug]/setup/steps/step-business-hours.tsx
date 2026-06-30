'use client';

import { useTenantConfig } from '@/lib/context/tenant-config';
import type { WizardState } from '../wizard-shell';

interface Props {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
  error?: string;
}

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const inputCls =
  'bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-zinc-500';

export default function StepBusinessHours({ state, onChange, error }: Props) {
  const { terminology } = useTenantConfig();
  const staffPluralLower = terminology.staff_plural.toLowerCase();

  function updateDay(dayOfWeek: number, updates: Partial<WizardState['business_hours'][number]>) {
    const next = state.business_hours.map(h =>
      h.day_of_week === dayOfWeek ? { ...h, ...updates } : h
    );
    onChange({ business_hours: next });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={state.business_hours_enabled}
            onChange={e => onChange({ business_hours_enabled: e.target.checked })}
            className="accent-white w-4 h-4"
          />
          <div>
            <span className="text-sm text-white">Enable business hours</span>
          </div>
        </label>

        <div className="mt-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2.5">
          {state.business_hours_enabled ? (
            <p className="text-xs text-zinc-400">
              Customers can book any time your business is open. You assign a
              {' '}{terminology.staff.toLowerCase()} afterward.
            </p>
          ) : (
            <p className="text-xs text-zinc-400">
              Customers can only book when a specific {terminology.staff.toLowerCase()} is
              available. This is the default — no business hours schedule needed.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {[1, 2, 3, 4, 5, 6, 0].map(day => {
          const row = state.business_hours.find(h => h.day_of_week === day);
          if (!row) return null;
          const isOpen = row.is_active;
          return (
            <div
              key={day}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                isOpen ? 'border-zinc-700 bg-zinc-800' : 'border-zinc-800 bg-zinc-900'
              }`}
            >
              <label className="flex items-center gap-2 w-24 shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isOpen}
                  onChange={e => updateDay(day, { is_active: e.target.checked })}
                  className="accent-white"
                />
                <span className={`text-sm ${isOpen ? 'text-white' : 'text-zinc-600'}`}>
                  {DAY_LABELS[day]}
                </span>
              </label>
              {isOpen ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={row.open_time}
                    onChange={e => updateDay(day, { open_time: e.target.value })}
                    className={inputCls + ' w-28'}
                  />
                  <span className="text-xs text-zinc-500">to</span>
                  <input
                    type="time"
                    value={row.close_time}
                    onChange={e => updateDay(day, { close_time: e.target.value })}
                    className={inputCls + ' w-28'}
                  />
                </div>
              ) : (
                <span className="text-xs text-zinc-600">Closed</span>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
