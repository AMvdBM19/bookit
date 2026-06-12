'use client';

import type { CatalogStaff } from '../catalog-loader';
import { presentSocialLinks, socialHref } from '@/lib/social-links';

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€', USD: '$', GBP: '£',
};

interface Props {
  staff: CatalogStaff[];
  staffLabel: string;
  staffPluralLower: string;
  onSelect: (id: string) => void;
  brandColor: string;
  showPrice: boolean;
  currency: string;
}

function getInitial(name: string): string {
  return (name?.[0] ?? '?').toUpperCase();
}

const ICON_PROPS = {
  width: 12,
  height: 12,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function InstagramIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.5" y2="6.5" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg {...ICON_PROPS}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

const SOCIAL_ICONS: Record<string, () => React.ReactElement> = {
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  facebook: FacebookIcon,
  x: XIcon,
  website: GlobeIcon,
};

export default function StaffBrowse({
  staff,
  staffPluralLower,
  onSelect,
  brandColor,
  showPrice,
  currency,
}: Props) {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency;
  if (staff.length === 0) {
    return (
      <div className="w-card w-pad-lg text-center">
        <p className="w-tx2 text-sm">
          No {staffPluralLower} are currently available. Please check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {staff.map(s => {
        const photo = s.photo_urls?.[0];
        const socials = presentSocialLinks(s.social_links);
        const languages = (s.languages ?? []).filter(Boolean);
        return (
          <div
            key={s.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(s.id)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(s.id);
              }
            }}
            className="w-full text-left cursor-pointer w-card w-pad transition-all w-hbd hover:shadow-md focus:outline-none w-focus"
          >
            <div className="flex items-start gap-3">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo}
                  alt={s.pseudonym}
                  className="w-14 h-14 rounded-full object-cover border w-bd2 shrink-0"
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
                <p className="w-tx text-sm font-semibold">{s.pseudonym}</p>
                {s.bio && (
                  <p className="w-tx2 text-xs mt-1 line-clamp-2">{s.bio}</p>
                )}

                {s.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {s.tags.slice(0, 4).map(t => (
                      <span
                        key={t.id}
                        className="w-el border w-bd2 rounded-full px-2 py-0.5 text-[11px] w-tx-soft"
                      >
                        {t.name}
                        {showPrice && t.extra_price > 0 && (
                          <span className="w-tx3 ml-1">+{sym}{t.extra_price}</span>
                        )}
                      </span>
                    ))}
                    {s.tags.length > 4 && (
                      <span className="text-[11px] w-tx3 px-1">
                        +{s.tags.length - 4}
                      </span>
                    )}
                  </div>
                )}

                {languages.length > 0 && (
                  <p className="text-[10px] w-tx3 mt-2">
                    Speaks: {languages.join(', ')}
                  </p>
                )}

                {socials.length > 0 && (
                  <div className="flex gap-1.5 mt-2 w-tx2">
                    {socials.map(([key, value]) => {
                      const Icon = SOCIAL_ICONS[key];
                      return (
                        <a
                          key={key}
                          href={socialHref(key, value)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center border w-bd2 rounded px-1.5 py-0.5 w-hbd w-focus"
                          aria-label={`${s.pseudonym} on ${key}`}
                          title={value}
                        >
                          {Icon ? <Icon /> : <span className="text-[10px]">{key}</span>}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
