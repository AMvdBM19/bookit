'use client';

import { useTenantConfig } from '@/lib/context/tenant-config';
import type { StaffWizardState } from '../wizard-shell';

interface Props {
  state: StaffWizardState;
  onChange: (updates: Partial<StaffWizardState>) => void;
  error?: string;
}

const inputCls =
  'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500';
const labelCls = 'block text-xs text-zinc-400 mb-1';

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say'];

const SOCIAL_FIELDS: Array<{ key: keyof StaffWizardState['social_links']; label: string; placeholder: string }> = [
  { key: 'instagram', label: 'Instagram', placeholder: '@username' },
  { key: 'tiktok', label: 'TikTok', placeholder: '@username' },
  { key: 'facebook', label: 'Facebook', placeholder: 'Profile URL' },
  { key: 'x', label: 'X / Twitter', placeholder: '@handle' },
  { key: 'website', label: 'Website', placeholder: 'https://...' },
];

export default function StepProfile({ state, onChange, error }: Props) {
  const { terminology, featureFlags } = useTenantConfig();
  const nameRequired = featureFlags.staff_require_pseudonym;
  const nameLabel = nameRequired ? 'Pseudonym' : `${terminology.staff} Name`;

  function updateSocialLink(key: keyof StaffWizardState['social_links'], value: string) {
    onChange({ social_links: { ...state.social_links, [key]: value } });
  }

  function handleLanguagesChange(value: string) {
    const langs = value
      .split(',')
      .map(l => l.trim())
      .filter(Boolean);
    onChange({ languages: langs });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls} htmlFor="pseudonym">
          {nameLabel} {nameRequired && <span className="text-red-400">*</span>}
        </label>
        <input
          id="pseudonym"
          type="text"
          value={state.pseudonym}
          onChange={e => onChange({ pseudonym: e.target.value })}
          className={inputCls}
          placeholder={nameRequired ? 'Your working name' : 'Your display name'}
        />
      </div>

      <div>
        <label className={labelCls} htmlFor="bio">
          Bio
        </label>
        <textarea
          id="bio"
          value={state.bio}
          onChange={e => onChange({ bio: e.target.value })}
          className={inputCls + ' h-24 resize-none'}
          placeholder="Tell clients about yourself..."
          maxLength={500}
        />
      </div>

      <div>
        <label className={labelCls} htmlFor="languages">
          Languages <span className="text-zinc-600">(comma-separated)</span>
        </label>
        <input
          id="languages"
          type="text"
          value={state.languages.join(', ')}
          onChange={e => handleLanguagesChange(e.target.value)}
          className={inputCls}
          placeholder="English, Dutch, German"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls} htmlFor="gender">
            Gender
          </label>
          <select
            id="gender"
            value={state.gender}
            onChange={e => onChange({ gender: e.target.value })}
            className={inputCls}
          >
            <option value="">—</option>
            {GENDER_OPTIONS.map(g => (
              <option key={g} value={g.toLowerCase()}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="nationality">
            Nationality
          </label>
          <input
            id="nationality"
            type="text"
            value={state.nationality}
            onChange={e => onChange({ nationality: e.target.value })}
            className={inputCls}
            placeholder="e.g. Dutch"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="age">
            Age
          </label>
          <input
            id="age"
            type="number"
            min={18}
            max={99}
            value={state.age ?? ''}
            onChange={e =>
              onChange({ age: e.target.value ? Number(e.target.value) : null })
            }
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <p className="text-xs text-zinc-400 mb-2">Social Links</p>
        <div className="space-y-2">
          {SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 w-20 shrink-0">{label}</span>
              <input
                type="text"
                value={state.social_links[key]}
                onChange={e => updateSocialLink(key, e.target.value)}
                className={inputCls}
                placeholder={placeholder}
              />
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
