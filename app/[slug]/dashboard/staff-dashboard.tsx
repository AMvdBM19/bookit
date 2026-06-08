'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { useTenantConfig } from '@/lib/context/tenant-config';
import StaffBookingCard from './staff-booking-card';

interface BookingRow {
  id: string;
  slot_date: string;
  slot_start: string;
  slot_end: string;
  duration_minutes: number;
  booking_notes: string | null;
  status: string;
  clients: Array<{ display_name: string }> | { display_name: string } | null;
  guest_clients: Array<{ name: string }> | { name: string } | null;
  booking_service_tags: Array<{ tag_name: string }>;
}

function getClientName(booking: BookingRow): string {
  const client = Array.isArray(booking.clients) ? booking.clients[0] : booking.clients;
  const guest = Array.isArray(booking.guest_clients) ? booking.guest_clients[0] : booking.guest_clients;
  return client?.display_name ?? guest?.name ?? 'Unknown';
}

function toCardBooking(b: BookingRow) {
  return {
    id: b.id,
    slot_date: b.slot_date,
    slot_start: b.slot_start,
    slot_end: b.slot_end,
    duration_minutes: b.duration_minutes,
    booking_notes: b.booking_notes,
    tags: b.booking_service_tags?.map(t => t.tag_name) ?? [],
    clientName: getClientName(b),
  };
}

interface StaffProfile {
  pseudonym: string;
  bio: string | null;
  gender: string | null;
  nationality: string | null;
  age: number | null;
  languages: string[];
  socialLinks: Record<string, string>;
  tags: string[];
  tagIds: string[];
  schedule: Array<{ day: string; start: string; end: string }>;
  rawSchedule: Array<{ day_of_week: number; start_time: string; end_time: string }>;
}

interface TenantTag {
  id: string;
  name: string;
}

interface Props {
  slug: string;
  tenantName: string;
  pendingBookings: BookingRow[];
  upcomingBookings: BookingRow[];
  staffProfile?: StaffProfile;
  tenantTags?: TenantTag[];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500';

export default function StaffDashboard({
  slug,
  tenantName,
  pendingBookings,
  upcomingBookings,
  staffProfile,
  tenantTags = [],
}: Props) {
  const router = useRouter();
  const { terminology } = useTenantConfig();
  const bookingLabel = terminology.booking;

  async function handleSignOut() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    router.push(`/${slug}/login`);
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-white text-xl font-semibold">
              Welcome, {staffProfile?.pseudonym ?? terminology.staff}
            </h1>
            <p className="text-zinc-500 text-sm mt-1">{tenantName}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-zinc-400 hover:text-white text-sm transition-colors flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>

        {staffProfile && (
          <ProfileSection slug={slug} profile={staffProfile} />
        )}

        {staffProfile && tenantTags.length > 0 && (
          <TagsSection slug={slug} tagIds={staffProfile.tagIds} tenantTags={tenantTags} />
        )}

        {staffProfile && (
          <ScheduleSection slug={slug} rawSchedule={staffProfile.rawSchedule} />
        )}

        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-white text-sm font-medium">Pending Requests</h2>
            {pendingBookings.length > 0 && (
              <span className="bg-zinc-700 text-white text-[11px] font-medium px-2 py-0.5 rounded-full">
                {pendingBookings.length}
              </span>
            )}
          </div>
          {pendingBookings.length === 0 ? (
            <p className="text-zinc-600 text-sm">No pending requests right now.</p>
          ) : (
            <div className="space-y-3">
              {pendingBookings.map(b => (
                <StaffBookingCard
                  key={b.id}
                  slug={slug}
                  booking={toCardBooking(b)}
                  showActions={true}
                  bookingLabel={bookingLabel}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-white text-sm font-medium mb-4">Upcoming This Week</h2>
          {upcomingBookings.length === 0 ? (
            <p className="text-zinc-600 text-sm">
              No upcoming {terminology.booking_plural.toLowerCase()} yet — they&apos;ll appear here once clients book with you.
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.map(b => (
                <StaffBookingCard
                  key={b.id}
                  slug={slug}
                  booking={toCardBooking(b)}
                  showActions={false}
                  bookingLabel={bookingLabel}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ProfileSection({ slug, profile }: { slug: string; profile: StaffProfile }) {
  const { terminology } = useTenantConfig();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pseudonym, setPseudonym] = useState(profile.pseudonym);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [gender, setGender] = useState(profile.gender ?? '');
  const [nationality, setNationality] = useState(profile.nationality ?? '');
  const [age, setAge] = useState(profile.age?.toString() ?? '');
  const [languages, setLanguages] = useState(profile.languages.join(', '));
  const [socialLinks, setSocialLinks] = useState(profile.socialLinks);
  const router = useRouter();

  function startEdit() {
    setPseudonym(profile.pseudonym);
    setBio(profile.bio ?? '');
    setGender(profile.gender ?? '');
    setNationality(profile.nationality ?? '');
    setAge(profile.age?.toString() ?? '');
    setLanguages(profile.languages.join(', '));
    setSocialLinks(profile.socialLinks);
    setError('');
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/${slug}/staff/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pseudonym,
          bio,
          gender: gender || null,
          nationality: nationality || null,
          age: age ? Number(age) : null,
          languages: languages.split(',').map(l => l.trim()).filter(Boolean),
          social_links: socialLinks,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to save');
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  const socials = Object.entries(profile.socialLinks).filter(([, v]) => v);

  return (
    <section className="mb-8 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white text-sm font-medium">Your Profile</h2>
        {editing ? (
          <div className="flex gap-1">
            <button type="button" onClick={() => setEditing(false)} disabled={saving} className="text-xs px-2 py-1 text-zinc-400 hover:text-white">
              Cancel
            </button>
            <button type="button" onClick={save} disabled={saving} className="text-xs px-3 py-1 bg-white text-zinc-900 rounded hover:bg-zinc-200 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        ) : (
          <button type="button" onClick={startEdit} className="text-xs px-2 py-1 text-zinc-400 hover:text-white">
            Edit Profile
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">{terminology.staff} name</label>
            <input type="text" value={pseudonym} onChange={e => setPseudonym(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Bio</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} className={inputCls + ' h-20 resize-none'} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Gender</label>
              <input type="text" value={gender} onChange={e => setGender(e.target.value)} className={inputCls} placeholder="e.g. Female" />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Nationality</label>
              <input type="text" value={nationality} onChange={e => setNationality(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Age</label>
              <input type="number" min={18} value={age} onChange={e => setAge(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Languages (comma separated)</label>
            <input type="text" value={languages} onChange={e => setLanguages(e.target.value)} className={inputCls} placeholder="English, Dutch" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Social links</label>
            <div className="space-y-1.5">
              {['instagram', 'tiktok', 'facebook', 'x', 'website'].map(key => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-500 w-16 shrink-0 capitalize">{key}</span>
                  <input
                    type="text"
                    value={socialLinks[key] ?? ''}
                    onChange={e => setSocialLinks(prev => ({ ...prev, [key]: e.target.value }))}
                    className={inputCls}
                    placeholder={key === 'website' ? 'https://...' : `@handle`}
                  />
                </div>
              ))}
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
      ) : (
        <>
          {profile.bio && <p className="text-zinc-400 text-sm mb-3">{profile.bio}</p>}
          {(profile.gender || profile.nationality || profile.age) && (
            <p className="text-zinc-500 text-xs mb-2">
              {[profile.gender, profile.nationality, profile.age ? `${profile.age}y` : null].filter(Boolean).join(' · ')}
            </p>
          )}
          {profile.languages.length > 0 && (
            <p className="text-zinc-500 text-xs mb-2">Speaks: {profile.languages.join(', ')}</p>
          )}
          {socials.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {socials.map(([key, val]) => (
                <span key={key} className="bg-zinc-800 text-zinc-400 text-[11px] px-2 py-0.5 rounded border border-zinc-700">
                  {key}: {val}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function TagsSection({ slug, tagIds, tenantTags }: { slug: string; tagIds: string[]; tenantTags: TenantTag[] }) {
  const { terminology } = useTenantConfig();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(tagIds));
  const router = useRouter();

  function startEdit() {
    setSelected(new Set(tagIds));
    setError('');
    setEditing(true);
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (selected.size === 0) {
      setError('Select at least one');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/${slug}/staff/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_ids: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to save');
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  const currentTagNames = tenantTags.filter(t => tagIds.includes(t.id)).map(t => t.name);
  const tagLabel = terminology.service_tag ?? 'Service';

  return (
    <section className="mb-8 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white text-sm font-medium">{tagLabel} Tags</h2>
        {editing ? (
          <div className="flex gap-1">
            <button type="button" onClick={() => setEditing(false)} disabled={saving} className="text-xs px-2 py-1 text-zinc-400 hover:text-white">
              Cancel
            </button>
            <button type="button" onClick={save} disabled={saving} className="text-xs px-3 py-1 bg-white text-zinc-900 rounded hover:bg-zinc-200 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        ) : (
          <button type="button" onClick={startEdit} className="text-xs px-2 py-1 text-zinc-400 hover:text-white">
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div>
          <div className="flex flex-wrap gap-2">
            {tenantTags.map(tag => {
              const active = selected.has(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggle(tag.id)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    active
                      ? 'bg-white text-zinc-900 border-white'
                      : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-500'
                  }`}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {currentTagNames.length > 0 ? currentTagNames.map(tag => (
            <span key={tag} className="bg-zinc-800 text-zinc-300 text-xs px-2 py-0.5 rounded">
              {tag}
            </span>
          )) : (
            <p className="text-zinc-600 text-xs">No tags selected.</p>
          )}
        </div>
      )}
    </section>
  );
}

interface ScheduleEntry {
  day_of_week: number;
  enabled: boolean;
  start_time: string;
  end_time: string;
}

function ScheduleSection({ slug, rawSchedule }: { slug: string; rawSchedule: Array<{ day_of_week: number; start_time: string; end_time: string }> }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const activeDays = new Set(rawSchedule.map(s => s.day_of_week));
  const scheduleMap = Object.fromEntries(rawSchedule.map(s => [s.day_of_week, s]));

  const [days, setDays] = useState<ScheduleEntry[]>(() =>
    DAY_NAMES.map((_, i) => ({
      day_of_week: i,
      enabled: activeDays.has(i),
      start_time: scheduleMap[i]?.start_time ?? '09:00',
      end_time: scheduleMap[i]?.end_time ?? '17:00',
    }))
  );

  function startEdit() {
    setDays(DAY_NAMES.map((_, i) => ({
      day_of_week: i,
      enabled: activeDays.has(i),
      start_time: scheduleMap[i]?.start_time ?? '09:00',
      end_time: scheduleMap[i]?.end_time ?? '17:00',
    })));
    setError('');
    setEditing(true);
  }

  function updateDay(idx: number, updates: Partial<ScheduleEntry>) {
    setDays(prev => prev.map((d, i) => i === idx ? { ...d, ...updates } : d));
  }

  async function save() {
    const enabled = days.filter(d => d.enabled);
    if (enabled.length === 0) {
      setError('Enable at least one day');
      return;
    }
    for (const d of enabled) {
      if (d.start_time >= d.end_time) {
        setError(`${DAY_NAMES[d.day_of_week]}: start must be before end`);
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/${slug}/staff/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule: enabled.map(d => ({
            day_of_week: d.day_of_week,
            start_time: d.start_time,
            end_time: d.end_time,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to save');
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  const displaySchedule = rawSchedule.map(s => ({
    day: DAY_NAMES[s.day_of_week],
    start: s.start_time,
    end: s.end_time,
  }));

  return (
    <section className="mb-8 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white text-sm font-medium">Schedule</h2>
        {editing ? (
          <div className="flex gap-1">
            <button type="button" onClick={() => setEditing(false)} disabled={saving} className="text-xs px-2 py-1 text-zinc-400 hover:text-white">
              Cancel
            </button>
            <button type="button" onClick={save} disabled={saving} className="text-xs px-3 py-1 bg-white text-zinc-900 rounded hover:bg-zinc-200 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        ) : (
          <button type="button" onClick={startEdit} className="text-xs px-2 py-1 text-zinc-400 hover:text-white">
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          {days.map((d, idx) => (
            <div key={d.day_of_week} className="flex items-center gap-3">
              <label className="flex items-center gap-2 w-16 shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={d.enabled}
                  onChange={e => updateDay(idx, { enabled: e.target.checked })}
                  className="accent-white"
                />
                <span className={`text-xs ${d.enabled ? 'text-white' : 'text-zinc-600'}`}>
                  {DAY_NAMES[d.day_of_week]}
                </span>
              </label>
              {d.enabled && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={d.start_time}
                    onChange={e => updateDay(idx, { start_time: e.target.value })}
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-zinc-500"
                  />
                  <span className="text-zinc-600 text-xs">–</span>
                  <input
                    type="time"
                    value={d.end_time}
                    onChange={e => updateDay(idx, { end_time: e.target.value })}
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-zinc-500"
                  />
                </div>
              )}
            </div>
          ))}
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </div>
      ) : (
        <>
          {displaySchedule.length > 0 ? (
            <div className="text-zinc-500 text-xs space-y-0.5">
              {displaySchedule.map(s => (
                <div key={s.day}>{s.day}: {s.start} – {s.end}</div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-600 text-xs">No schedule set up yet.</p>
          )}
        </>
      )}
    </section>
  );
}
