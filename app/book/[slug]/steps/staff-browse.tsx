'use client';

import type { CatalogStaff } from '../catalog-loader';

interface Props {
  staff: CatalogStaff[];
  staffLabel: string;
  staffPluralLower: string;
  onSelect: (id: string) => void;
  brandColor: string;
}

const SOCIAL_LABELS: Record<string, string> = {
  instagram: 'IG',
  tiktok: 'TT',
  facebook: 'FB',
  x: 'X',
  website: '🌐',
};

function getInitial(name: string): string {
  return (name?.[0] ?? '?').toUpperCase();
}

export default function StaffBrowse({
  staff,
  staffPluralLower,
  onSelect,
  brandColor,
}: Props) {
  if (staff.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
        <p className="text-zinc-400 text-sm">
          No {staffPluralLower} are currently available. Please check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {staff.map(s => {
        const photo = s.photo_urls?.[0];
        const socials = Object.entries(s.social_links ?? {}).filter(([, v]) => v);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className="w-full text-left rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-600 transition-colors"
          >
            <div className="flex items-start gap-3">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo}
                  alt={s.pseudonym}
                  className="w-14 h-14 rounded-full object-cover border border-zinc-700 shrink-0"
                />
              ) : (
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-semibold shrink-0"
                  style={{ backgroundColor: brandColor }}
                >
                  {getInitial(s.pseudonym)}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold">{s.pseudonym}</p>
                {s.bio && (
                  <p className="text-zinc-400 text-xs mt-1 line-clamp-2">{s.bio}</p>
                )}

                {s.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {s.tags.slice(0, 4).map(t => (
                      <span
                        key={t.id}
                        className="bg-zinc-800 border border-zinc-700 rounded-full px-2 py-0.5 text-[11px] text-zinc-300"
                      >
                        {t.name}
                      </span>
                    ))}
                    {s.tags.length > 4 && (
                      <span className="text-[11px] text-zinc-500 px-1">
                        +{s.tags.length - 4}
                      </span>
                    )}
                  </div>
                )}

                {socials.length > 0 && (
                  <div className="flex gap-1.5 mt-2">
                    {socials.map(([key]) => (
                      <span
                        key={key}
                        className="text-[10px] text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5"
                      >
                        {SOCIAL_LABELS[key] ?? key.toUpperCase()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
