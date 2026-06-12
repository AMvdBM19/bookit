/**
 * Staff social links normalization + href building.
 *
 * Storage contract (enforced at save time): only non-empty values are kept,
 * handles are stored bare (no leading @), full http(s) URLs are kept as
 * entered. Render-side helpers stay defensive about legacy data ("@handle",
 * empty strings) that predates this contract.
 */

export const SOCIAL_KEYS = ['instagram', 'tiktok', 'facebook', 'x', 'website'] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

/** Trim, drop empty values, strip a leading @ from bare handles. */
export function normalizeSocialLinks(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof input !== 'object' || input === null) return out;
  for (const key of SOCIAL_KEYS) {
    const raw = (input as Record<string, unknown>)[key];
    if (typeof raw !== 'string') continue;
    let value = raw.trim().slice(0, 500);
    if (!value) continue;
    if (!/^https?:\/\//i.test(value)) {
      value = value.replace(/^@+/, '');
    }
    if (value) out[key] = value;
  }
  return out;
}

/** Entries with a usable value, for rendering. Tolerates legacy data. */
export function presentSocialLinks(
  links: Record<string, string> | null | undefined
): Array<[string, string]> {
  return Object.entries(links ?? {}).filter(([, v]) => typeof v === 'string' && v.trim() !== '');
}

/** Canonical profile URL for a stored value (full URL, @handle, or bare handle). */
export function socialHref(key: string, value: string): string {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  const handle = encodeURIComponent(v.replace(/^@+/, ''));
  switch (key) {
    case 'instagram':
      return `https://instagram.com/${handle}`;
    case 'tiktok':
      return `https://tiktok.com/@${handle}`;
    case 'facebook':
      return `https://facebook.com/${handle}`;
    case 'x':
      return `https://x.com/${handle}`;
    case 'website':
    default:
      // Not a handle network: treat the raw value as a host/path.
      return `https://${v.replace(/^@+/, '')}`;
  }
}
