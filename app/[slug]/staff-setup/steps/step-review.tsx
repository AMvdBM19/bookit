'use client';

import { useTenantConfig } from '@/lib/context/tenant-config';
import type { StaffWizardState } from '../wizard-shell';

interface Props {
  state: StaffWizardState;
  availableTags: Array<{ id: string; name: string }>;
  error?: string;
}

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-zinc-800 last:border-0">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-xs text-white text-right">{value}</span>
    </div>
  );
}

export default function StepReview({ state, availableTags, error }: Props) {
  const { terminology, featureFlags } = useTenantConfig();
  const selectedTagNames = availableTags
    .filter(t => state.selected_tag_ids.includes(t.id))
    .map(t => t.name);

  const enabledDays = DISPLAY_ORDER
    .map(dow => state.schedule.find(d => d.day_of_week === dow)!)
    .filter(d => d.enabled);

  const socialEntries = Object.entries(state.social_links).filter(([, v]) => v);

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        Review your profile. You can go back to change anything.
      </p>

      <section>
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
          Profile
        </h3>
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 px-3">
          <Row
            label={featureFlags.staff_require_pseudonym ? 'Pseudonym' : 'Display Name'}
            value={state.pseudonym}
          />
          <Row label="Bio" value={state.bio} />
          <Row label="Languages" value={state.languages.join(', ')} />
          <Row label="Gender" value={state.gender} />
          <Row label="Nationality" value={state.nationality} />
          <Row label="Age" value={state.age?.toString() ?? ''} />
        </div>
      </section>

      {socialEntries.length > 0 && (
        <section>
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
            Social Links
          </h3>
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 px-3">
            {socialEntries.map(([key, value]) => (
              <Row key={key} label={key} value={value} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
          {terminology.service_tag}
        </h3>
        <div className="flex flex-wrap gap-2">
          {selectedTagNames.map(name => (
            <span
              key={name}
              className="bg-zinc-800 border border-zinc-700 rounded-full px-3 py-1 text-xs text-white"
            >
              {name}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
          Schedule
        </h3>
        {enabledDays.length === 0 ? (
          <p className="text-xs text-zinc-600 italic">No days enabled.</p>
        ) : (
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 px-3">
            {enabledDays.map(d => (
              <Row
                key={d.day_of_week}
                label={DAY_LABELS[d.day_of_week]}
                value={`${d.start_time} – ${d.end_time}`}
              />
            ))}
          </div>
        )}
      </section>

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
