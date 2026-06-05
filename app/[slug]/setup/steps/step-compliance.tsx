'use client';

import { useTenantConfig } from '@/lib/context/tenant-config';
import type { ComplianceFlags } from '@/lib/types/tenant-config';
import type { WizardState } from '../wizard-shell';

interface Props {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
  error?: string;
}

const inputCls =
  'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500';
const labelCls = 'block text-xs text-zinc-400 mb-1';

const COMPLIANCE_NOTICES: Record<keyof ComplianceFlags, string> = {
  show_kvk_field: 'A KVK (Chamber of Commerce) registration number is required.',
  show_license_field: 'A municipal / operating license number is required.',
  show_bsn_on_staff: 'Staff BSN (social security number) is recorded for compliance.',
  show_gdpr_photo_consent: 'GDPR photo consent must be signed by staff.',
  require_terms_acceptance: 'Clients must accept terms & conditions before booking.',
};

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

export default function StepCompliance({ state, onChange, error }: Props) {
  const { complianceFlags, featureFlags } = useTenantConfig();

  const activeNotices = (Object.keys(COMPLIANCE_NOTICES) as (keyof ComplianceFlags)[]).filter(
    key => complianceFlags[key]
  );

  return (
    <div className="space-y-5">
      {/* Tenant-editable: age gate */}
      {featureFlags.show_age_gate_step && (
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
        </div>
      )}

      {/* Read-only: industry compliance notices */}
      {activeNotices.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500">
            The following compliance requirements are set for your industry and cannot be
            changed.
          </p>
          {activeNotices.map(key => (
            <div
              key={key}
              className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4"
            >
              <span className="text-blue-300 text-sm leading-none mt-0.5">ℹ</span>
              <p className="text-xs text-blue-100">{COMPLIANCE_NOTICES[key]}</p>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
