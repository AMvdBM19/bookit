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

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'];

export default function StepFinancial({ state, onChange, error }: Props) {
  const agencyPct = Math.max(0, 100 - state.staff_payout_pct);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="base_rate_per_30min">
            Base Rate / 30 min <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">
              {state.currency}
            </span>
            <input
              id="base_rate_per_30min"
              type="number"
              min={0}
              step={0.01}
              value={state.base_rate_per_30min}
              onChange={e => onChange({ base_rate_per_30min: Number(e.target.value) })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
            />
          </div>
          <p className="text-xs text-zinc-600 mt-1">Set 0 for free bookings or consultations.</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="currency">
            Currency
          </label>
          <select
            id="currency"
            value={state.currency}
            onChange={e => onChange({ currency: e.target.value })}
            className={inputCls}
          >
            {CURRENCIES.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls} htmlFor="staff_payout_pct">
          Staff Payout % <span className="text-red-400">*</span>
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={state.staff_payout_pct}
            onChange={e => onChange({ staff_payout_pct: Number(e.target.value) })}
            aria-label="Staff payout percentage"
            className="flex-1 accent-white"
          />
          <input
            id="staff_payout_pct"
            type="number"
            min={0}
            max={100}
            step={1}
            value={state.staff_payout_pct}
            onChange={e =>
              onChange({
                staff_payout_pct: Math.max(0, Math.min(100, Number(e.target.value))),
              })
            }
            className={inputCls + ' w-20 flex-none'}
          />
        </div>
        <p className="text-xs text-zinc-600 mt-1">
          Staff {state.staff_payout_pct}% / Agency {agencyPct}%. This is locked after setup.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="tax_rate_pct">
            Tax Rate % <span className="text-red-400">*</span>
          </label>
          <input
            id="tax_rate_pct"
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={state.tax_rate_pct}
            onChange={e => onChange({ tax_rate_pct: Number(e.target.value) })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="tax_label">
            Tax Label <span className="text-red-400">*</span>
          </label>
          <input
            id="tax_label"
            type="text"
            value={state.tax_label}
            onChange={e => onChange({ tax_label: e.target.value })}
            className={inputCls}
            placeholder="BTW"
            maxLength={10}
          />
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-500">
        Staff payout %, tax rate and tax label are <span className="text-zinc-300">locked</span> after
        launch and cannot be changed without contacting support. Currency and base
        rate stay editable in the dashboard.
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
