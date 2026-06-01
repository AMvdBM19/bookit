'use client';

import type { VerticalConfig } from '@/lib/verticals/types';
import type { WizardState } from '../wizard-shell';

interface Props {
  state: WizardState;
  config: VerticalConfig;
  error?: string;
}

function Row({ label, value }: { label: string; value: string | number | boolean }) {
  const display =
    typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value || '—');
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-zinc-800 last:border-0">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-xs text-white text-right">{display}</span>
    </div>
  );
}

export default function StepReview({ state, config, error }: Props) {
  const isAdult = config.id === 'adult_services';
  const agencyPct = Math.max(0, 100 - state.staff_payout_pct);

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        Review your settings. You can go back to change anything. Financial fields marked
        with a lock are permanent after launch.
      </p>

      <section>
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
          Identity
        </h3>
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 px-3">
          <Row label={isAdult ? 'Agency Name' : 'Studio Name'} value={state.agency_display_name} />
          {config.show_kvk_field && <Row label="KVK Number" value={state.kvk_number} />}
          {config.show_license_field && <Row label="License Number" value={state.license_number} />}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
          Branding
        </h3>
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 px-3">
          <div className="flex justify-between gap-4 py-2 border-b border-zinc-800">
            <span className="text-xs text-zinc-500">Brand Color</span>
            <div className="flex items-center gap-2">
              <span
                className="w-4 h-4 rounded-full border border-zinc-700"
                style={{ backgroundColor: state.brand_color }}
              />
              <span className="text-xs text-white font-mono">{state.brand_color}</span>
            </div>
          </div>
          {state.logo_url && <Row label="Logo URL" value="Set" />}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
          Booking Rules
        </h3>
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 px-3">
          <Row label="Slot Duration" value={`${state.default_slot_minutes} min`} />
          <Row label="Min Lead Time" value={`${state.min_lead_time_hours}h`} />
          <Row
            label="Confirm Mode"
            value={
              state.booking_confirm_mode === 'staff_must_accept'
                ? 'Staff must accept'
                : 'Auto-confirm'
            }
          />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
          Financial <span className="text-zinc-600 normal-case font-normal">(locked after launch)</span>
        </h3>
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 px-3">
          <Row label="Base Rate / 30 min" value={`${state.currency} ${state.base_rate_per_30min}`} />
          <Row label="Staff Payout" value={`${state.staff_payout_pct}%`} />
          <Row label="Agency Share" value={`${agencyPct}%`} />
          <Row label="Tax" value={`${state.tax_rate_pct}% ${state.tax_label}`} />
          <Row label="Currency" value={state.currency} />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
          Age Gate
        </h3>
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 px-3">
          <Row label="Minimum Age" value={state.age_gate_minimum} />
          <Row label="Require Confirmation" value={state.require_age_confirm} />
          {isAdult && <Row label="Require ID Upload" value={state.require_id_upload} />}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
          {config.terminology.service_plural}
        </h3>
        <div className="flex flex-wrap gap-2">
          {state.service_tags.map(tag => (
            <span
              key={tag}
              className="bg-zinc-800 border border-zinc-700 rounded-full px-3 py-1 text-xs text-white"
            >
              {tag}
            </span>
          ))}
        </div>
      </section>

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
