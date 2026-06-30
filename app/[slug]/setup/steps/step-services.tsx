'use client';

import { useState } from 'react';
import { useTenantConfig } from '@/lib/context/tenant-config';
import type { WizardState } from '../wizard-shell';

interface Props {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
  error?: string;
}

const inputCls =
  'flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500';

export default function StepServices({ state, onChange, error }: Props) {
  const { terminology } = useTenantConfig();
  const [newTag, setNewTag] = useState('');
  const serviceLabel = terminology.service_tag;
  const servicePluralLower = `${terminology.service_tag.toLowerCase()} options`;

  function addTag() {
    const trimmed = newTag.trim();
    if (!trimmed || state.service_tags.includes(trimmed)) return;
    onChange({ service_tags: [...state.service_tags, trimmed] });
    setNewTag('');
  }

  function removeTag(name: string) {
    onChange({ service_tags: state.service_tags.filter(t => t !== name) });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        These optional {servicePluralLower} let customers pick add-ons or
        sub-services when booking. They&apos;re pre-populated from your template —
        edit, remove, or add your own. You can also skip this step entirely.
      </p>

      <div className="flex flex-wrap gap-2">
        {state.service_tags.map(tag => (
          <span
            key={tag}
            className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 rounded-full px-3 py-1 text-sm text-white"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-zinc-500 hover:text-white transition-colors leading-none"
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        {state.service_tags.length === 0 && (
          <p className="text-xs text-zinc-600 italic">
            No {servicePluralLower} yet — that&apos;s fine. Your customers will book
            your main service directly.
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newTag}
          onChange={e => setNewTag(e.target.value)}
          onKeyDown={handleKeyDown}
          className={inputCls}
          placeholder={`Add ${serviceLabel.toLowerCase()}…`}
          maxLength={60}
        />
        <button
          type="button"
          onClick={addTag}
          className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg transition-colors"
        >
          Add
        </button>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
