'use client';

import type { VerticalConfig } from '@/lib/verticals/types';
import type { WizardState } from '../wizard-shell';

interface Props {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
  config: VerticalConfig;
  error?: string;
}

const inputCls =
  'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500';
const labelCls = 'block text-xs text-zinc-400 mb-1';

function Toggle({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
        checked ? 'border-white bg-zinc-800' : 'border-zinc-700 hover:border-zinc-600'
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 accent-white"
      />
      <div>
        <p className="text-sm text-white">{label}</p>
        {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
      </div>
    </label>
  );
}

export default function StepCompliance({ state, onChange, config, error }: Props) {
  const isAdult = config.id === 'adult_services';

  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls} htmlFor="age_gate_minimum">
          Minimum Age <span className="text-red-400">*</span>
        </label>
        <input
          id="age_gate_minimum"
          type="number"
          min={18}
          max={99}
          value={state.age_gate_minimum}
          onChange={e => onChange({ age_gate_minimum: Number(e.target.value) })}
          className={inputCls}
        />
        <p className="text-xs text-zinc-600 mt-1">
          Clients must confirm they are at least this age. Minimum 18.
        </p>
      </div>

      <Toggle
        id="require_age_confirm"
        label="Require age confirmation"
        description="Clients must tick a checkbox confirming their age before booking."
        checked={state.require_age_confirm}
        onChange={v => onChange({ require_age_confirm: v })}
      />

      {isAdult && (
        <Toggle
          id="require_id_upload"
          label="Require ID upload"
          description="Clients must upload a valid ID document before their first booking."
          checked={state.require_id_upload}
          onChange={v => onChange({ require_id_upload: v })}
        />
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
