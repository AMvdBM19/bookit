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

export default function StepIdentity({ state, onChange, config, error }: Props) {
  const isAdult = config.id === 'adult_services';
  const nameLabel = isAdult ? 'Agency Name' : 'Studio Name';

  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls} htmlFor="agency_display_name">
          {nameLabel} <span className="text-red-400">*</span>
        </label>
        <input
          id="agency_display_name"
          type="text"
          value={state.agency_display_name}
          onChange={e => onChange({ agency_display_name: e.target.value })}
          className={inputCls}
          placeholder={isAdult ? 'e.g. Velours Amsterdam' : 'e.g. InkHaus Studio'}
        />
      </div>

      {config.show_kvk_field && (
        <div>
          <label className={labelCls} htmlFor="kvk_number">
            KVK Number <span className="text-red-400">*</span>
          </label>
          <input
            id="kvk_number"
            type="text"
            value={state.kvk_number}
            onChange={e => onChange({ kvk_number: e.target.value })}
            className={inputCls}
            placeholder="8-digit KVK number"
            maxLength={20}
          />
        </div>
      )}

      {config.show_license_field && (
        <div>
          <label className={labelCls} htmlFor="license_number">
            License Number <span className="text-red-400">*</span>
          </label>
          <input
            id="license_number"
            type="text"
            value={state.license_number}
            onChange={e => onChange({ license_number: e.target.value })}
            className={inputCls}
            placeholder="Municipal / operating license"
          />
        </div>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
