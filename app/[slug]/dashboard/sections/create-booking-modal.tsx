'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useTenantConfig } from '@/lib/context/tenant-config';
import Modal from '@/components/ui/modal';

interface SearchResult {
  id: string;
  type: 'client' | 'guest';
  name: string;
  email: string;
  phone: string | null;
}

interface StaffOption {
  id: string;
  pseudonym: string;
  status: string;
}

interface TagOption {
  id: string;
  name: string;
  extra_price: number | null;
  is_active: boolean;
}

type Status = 'pending_staff' | 'confirmed' | 'completed';

const inputCls =
  'w-full text-sm bg-elevated text-fg border border-border rounded px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-border-strong';
const labelCls = 'block text-xs text-fg-muted mb-1';

export default function CreateBookingModal({
  slug,
  onClose,
  onCreated,
}: {
  slug: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { terminology } = useTenantConfig();

  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [baseRate, setBaseRate] = useState(0);
  const [currency, setCurrency] = useState('EUR');

  // Client selection / manual entry
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  const [staffId, setStaffId] = useState<string>('');
  const [slotDate, setSlotDate] = useState('');
  const [slotStart, setSlotStart] = useState('');
  const [slotEnd, setSlotEnd] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [price, setPrice] = useState('');
  const [priceTouched, setPriceTouched] = useState(false);
  const [status, setStatus] = useState<Status>('confirmed');
  const [notifyClient, setNotifyClient] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load staff, tags, base rate.
  useEffect(() => {
    (async () => {
      const [staffRes, tagsRes, settingsRes] = await Promise.all([
        fetch(`/api/${slug}/staff`),
        fetch(`/api/${slug}/tags`),
        fetch(`/api/${slug}/settings/summary`),
      ]);
      const staffData = await staffRes.json().catch(() => ({}));
      const tagsData = await tagsRes.json().catch(() => ({}));
      const settingsData = await settingsRes.json().catch(() => ({}));
      setStaff((staffData.staff ?? []).filter((s: StaffOption) => s.status === 'active'));
      setTags((tagsData.tags ?? []).filter((t: TagOption) => t.is_active));
      setBaseRate(settingsData.settings?.base_rate_per_30min ?? 0);
      setCurrency(settingsData.settings?.currency ?? 'EUR');
    })();
  }, [slug]);

  // Debounced client search.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runSearch = useCallback(
    (term: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!term.trim()) {
        setSearchResults([]);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        setSearching(true);
        try {
          const res = await fetch(`/api/${slug}/bookings/search-clients?q=${encodeURIComponent(term)}`);
          const data = await res.json().catch(() => ({}));
          setSearchResults(data.results ?? []);
        } finally {
          setSearching(false);
        }
      }, 300);
    },
    [slug]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Auto-fill price when calculable and the user hasn't overridden it.
  const durationMinutes = (() => {
    if (!slotStart || !slotEnd) return 0;
    const [sh, sm] = slotStart.split(':').map(Number);
    const [eh, em] = slotEnd.split(':').map(Number);
    return eh * 60 + em - (sh * 60 + sm);
  })();

  useEffect(() => {
    if (priceTouched) return;
    if (durationMinutes > 0) {
      const tagExtras = tags
        .filter(t => selectedTags.has(t.id))
        .reduce((sum, t) => sum + (t.extra_price ?? 0), 0);
      const suggested = baseRate * (durationMinutes / 30) + tagExtras;
      setPrice(suggested > 0 ? String(Math.round(suggested * 100) / 100) : '');
    }
  }, [durationMinutes, selectedTags, tags, baseRate, priceTouched]);

  const phonePresent = !!(selected?.phone || guestPhone.trim());
  const canNotify = status === 'confirmed' && phonePresent;

  useEffect(() => {
    if (!canNotify && notifyClient) setNotifyClient(false);
  }, [canNotify, notifyClient]);

  function selectResult(r: SearchResult) {
    setSelected(r);
    setQuery('');
    setSearchResults([]);
  }

  function toggleTag(id: string) {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate time: all-or-nothing.
    const timeProvided = [slotDate, slotStart, slotEnd].filter(Boolean).length;
    if (timeProvided > 0 && timeProvided < 3) {
      setError('Provide date, start and end time together, or leave all blank.');
      return;
    }
    if (durationMinutes < 0) {
      setError('End time must be after start time.');
      return;
    }

    const body: Record<string, unknown> = {
      staff_id: staffId || null,
      tag_ids: Array.from(selectedTags),
      booking_notes: notes.trim() || undefined,
      status,
      notify_client: notifyClient,
    };

    if (selected) {
      if (selected.type === 'client') body.client_id = selected.id;
      else body.guest_client_id = selected.id;
    } else if (guestName.trim() && guestEmail.trim()) {
      body.guest_name = guestName.trim();
      body.guest_email = guestEmail.trim();
      if (guestPhone.trim()) body.guest_phone = guestPhone.trim();
    }

    if (timeProvided === 3) {
      body.slot_date = slotDate;
      body.slot_start = slotStart;
      body.slot_end = slotEnd;
    }

    if (price.trim() !== '') {
      const n = Number(price);
      if (!Number.isNaN(n)) body.total_price = n;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/${slug}/bookings/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to create booking');
        toast.error(data.error ?? "Couldn't create booking. Please try again.");
        return;
      }
      toast.success(`${terminology.booking} created.`);
      onCreated();
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`New ${terminology.booking}`} onClose={onClose}>
        <form onSubmit={submit} className="space-y-4">
          {/* Client */}
          <div>
            <label className={labelCls}>{terminology.client}</label>
            {selected ? (
              <div className="flex items-center justify-between gap-2 bg-elevated border border-border rounded px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-fg truncate">{selected.name}</p>
                  <p className="text-[11px] text-fg-muted truncate">
                    {selected.email}
                    {selected.phone ? ` · ${selected.phone}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-xs text-fg-muted hover:text-fg shrink-0"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <input
                    type="text"
                    value={query}
                    onChange={e => {
                      setQuery(e.target.value);
                      runSearch(e.target.value);
                    }}
                    placeholder={`Search ${terminology.client_plural.toLowerCase()} by name or email…`}
                    className={inputCls}
                  />
                  {(searching || searchResults.length > 0) && query.trim() && (
                    <div className="absolute z-10 mt-1 w-full bg-surface border border-border rounded shadow-lg max-h-48 overflow-y-auto">
                      {searching && <p className="px-3 py-2 text-xs text-fg-muted">Searching…</p>}
                      {!searching && searchResults.length === 0 && (
                        <p className="px-3 py-2 text-xs text-fg-muted">No matches.</p>
                      )}
                      {searchResults.map(r => (
                        <button
                          key={`${r.type}-${r.id}`}
                          type="button"
                          onClick={() => selectResult(r)}
                          className="w-full text-left px-3 py-2 hover:bg-elevated"
                        >
                          <span className="text-sm text-fg">{r.name}</span>
                          <span className="text-[11px] text-fg-muted ml-1">
                            {r.email} · {r.type}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-fg-muted mt-2 mb-1">…or enter a new {terminology.client.toLowerCase()}:</p>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={guestName}
                    onChange={e => setGuestName(e.target.value)}
                    placeholder="Name"
                    className={inputCls}
                  />
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={e => setGuestEmail(e.target.value)}
                    placeholder="Email"
                    className={inputCls}
                  />
                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={e => setGuestPhone(e.target.value)}
                    placeholder="Phone (optional)"
                    className={inputCls}
                  />
                </div>
              </>
            )}
          </div>

          {/* Staff */}
          <div>
            <label className={labelCls}>{terminology.staff}</label>
            <select value={staffId} onChange={e => setStaffId(e.target.value)} className={inputCls}>
              <option value="">Unassigned</option>
              {staff.map(s => (
                <option key={s.id} value={s.id}>
                  {s.pseudonym}
                </option>
              ))}
            </select>
          </div>

          {/* Date & time */}
          <div>
            <label className={labelCls}>Date &amp; time (optional)</label>
            <input
              type="date"
              value={slotDate}
              onChange={e => setSlotDate(e.target.value)}
              className={inputCls + ' mb-2'}
            />
            <div className="flex items-center gap-2">
              <input type="time" value={slotStart} onChange={e => setSlotStart(e.target.value)} className={inputCls} />
              <span className="text-fg-subtle text-xs">–</span>
              <input type="time" value={slotEnd} onChange={e => setSlotEnd(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <label className={labelCls}>{terminology.service_tag}</label>
              <div className="flex flex-wrap gap-2">
                {tags.map(t => {
                  const active = selectedTags.has(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTag(t.id)}
                      aria-pressed={active}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        active
                          ? 'bg-fg text-canvas border-transparent'
                          : 'bg-elevated text-fg-muted border-border hover:border-border-strong'
                      }`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className={labelCls}>{terminology.booking} notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className={inputCls + ' h-20 resize-none'}
              placeholder="Optional"
            />
          </div>

          {/* Price */}
          <div>
            <label className={labelCls}>Price ({currency})</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={e => {
                setPrice(e.target.value);
                setPriceTouched(true);
              }}
              className={inputCls}
              placeholder="0.00"
            />
          </div>

          {/* Status */}
          <div>
            <label className={labelCls}>Status</label>
            <div className="flex gap-3">
              {([
                ['pending_staff', 'Pending'],
                ['confirmed', 'Confirmed'],
                ['completed', 'Completed'],
              ] as Array<[Status, string]>).map(([val, lbl]) => (
                <label key={val} className="flex items-center gap-1.5 cursor-pointer text-sm text-fg">
                  <input
                    type="radio"
                    name="status"
                    value={val}
                    checked={status === val}
                    onChange={() => setStatus(val)}
                    className="accent-fg"
                  />
                  {lbl}
                </label>
              ))}
            </div>
          </div>

          {/* Notify */}
          <label
            className={`flex items-center gap-2 text-sm ${canNotify ? 'text-fg cursor-pointer' : 'text-fg-subtle cursor-not-allowed'}`}
          >
            <input
              type="checkbox"
              checked={notifyClient}
              disabled={!canNotify}
              onChange={e => setNotifyClient(e.target.checked)}
              className="accent-fg"
            />
            Notify {terminology.client.toLowerCase()} via WhatsApp
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="text-sm px-3 py-1.5 text-fg hover:bg-elevated rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="text-sm px-4 py-1.5 bg-fg text-canvas rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? 'Creating…' : `Create ${terminology.booking}`}
            </button>
          </div>
        </form>
    </Modal>
  );
}
