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

export default function StepBranding({ state, onChange, error }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls} htmlFor="brand_color">
          Brand Color <span className="text-red-400">*</span>
        </label>
        <div className="flex items-center gap-3">
          <input
            id="brand_color"
            type="color"
            value={state.brand_color}
            onChange={e => onChange({ brand_color: e.target.value })}
            className="h-9 w-14 rounded-lg border border-zinc-700 bg-zinc-800 cursor-pointer p-0.5"
          />
          <input
            type="text"
            value={state.brand_color}
            onChange={e => onChange({ brand_color: e.target.value })}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
            placeholder="#2BB673"
            maxLength={7}
          />
        </div>
      </div>

      <div>
        <label className={labelCls} htmlFor="logo_url">
          Logo URL <span className="text-zinc-600">(optional)</span>
        </label>
        <input
          id="logo_url"
          type="url"
          value={state.logo_url}
          onChange={e => onChange({ logo_url: e.target.value })}
          className={inputCls}
          placeholder="https://your-domain.com/logo.png"
        />
        <p className="text-xs text-zinc-600 mt-1">
          Paste a public URL to your logo. Leave blank to show your agency name.
        </p>
      </div>

      {state.logo_url && (
        <div className="rounded-lg border border-zinc-800 p-3 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={state.logo_url}
            alt="Logo preview"
            className="h-10 w-10 object-contain rounded"
            onError={e => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <span className="text-xs text-zinc-500">Logo preview</span>
        </div>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
