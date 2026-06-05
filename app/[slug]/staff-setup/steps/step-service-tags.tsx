'use client';

import { useTenantConfig } from '@/lib/context/tenant-config';
import type { StaffWizardState } from '../wizard-shell';

interface Props {
  state: StaffWizardState;
  onChange: (updates: Partial<StaffWizardState>) => void;
  availableTags: Array<{ id: string; name: string }>;
  error?: string;
}

export default function StepServiceTags({ state, onChange, availableTags, error }: Props) {
  const { terminology } = useTenantConfig();
  function toggleTag(tagId: string) {
    const current = state.selected_tag_ids;
    const next = current.includes(tagId)
      ? current.filter(id => id !== tagId)
      : [...current, tagId];
    onChange({ selected_tag_ids: next });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        Select the {terminology.service_tag.toLowerCase()} options you offer. At least one
        is required.
      </p>

      {availableTags.length === 0 ? (
        <p className="text-xs text-zinc-600 italic">
          No {terminology.service_tag.toLowerCase()} options have been set up yet. Ask your{' '}
          {terminology.operator.toLowerCase()} to add them.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {availableTags.map(tag => {
            const selected = state.selected_tag_ids.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  selected
                    ? 'bg-white text-zinc-900 border-white'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-500'
                }`}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-xs text-zinc-600">
        {state.selected_tag_ids.length} selected
      </p>

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
