'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';

interface Props {
  slug: string;
  staffId: string;
  initialPhotoUrls: string[];
  /** Notified after every successful change with the new list. */
  onChange?: (urls: string[]) => void;
  /** Visual variant: wizard (dark zinc) or dashboard (design tokens). */
  variant?: 'wizard' | 'dashboard';
}

/**
 * Photo upload + management for a staff profile. Uploads go through
 * POST /api/[slug]/staff/[staffId]/photo (5 MB, JPEG/PNG/WebP); a URL
 * input remains as fallback. Changes persist immediately.
 */
export default function StaffPhotoManager({
  slug,
  staffId,
  initialPhotoUrls,
  onChange,
  variant = 'dashboard',
}: Props) {
  const [photos, setPhotos] = useState<string[]>(initialPhotoUrls);
  const [busy, setBusy] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dark = variant === 'wizard';
  const btnCls = dark
    ? 'px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs rounded-lg transition-colors disabled:opacity-50'
    : 'text-xs px-3 py-1.5 bg-elevated hover:bg-sunken text-fg rounded disabled:opacity-50';
  const inputCls = dark
    ? 'flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500'
    : 'flex-1 text-sm bg-elevated text-fg border border-border rounded px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  const hintCls = dark ? 'text-xs text-zinc-600' : 'text-[11px] text-fg-muted';

  function apply(urls: string[]) {
    setPhotos(urls);
    onChange?.(urls);
  }

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/${slug}/staff/${staffId}/photo`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't upload photo. Please try again.");
        return;
      }
      apply(data.photo_urls ?? []);
      toast.success('Photo uploaded.');
    } catch {
      toast.error("Couldn't upload photo. Please try again.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleAddUrl() {
    const url = urlInput.trim();
    if (!url) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/${slug}/staff/${staffId}/photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't add photo URL. Please try again.");
        return;
      }
      apply(data.photo_urls ?? []);
      setUrlInput('');
      setShowUrlInput(false);
      toast.success('Photo added.');
    } catch {
      toast.error("Couldn't add photo URL. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(url: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/${slug}/staff/${staffId}/photo`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't remove photo. Please try again.");
        return;
      }
      apply(data.photo_urls ?? []);
      toast.success('Photo removed.');
    } catch {
      toast.error("Couldn't remove photo. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map(url => (
            <div key={url} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Profile photo"
                className={`w-16 h-16 rounded-lg object-cover border ${dark ? 'border-zinc-700' : 'border-border'}`}
              />
              <button
                type="button"
                onClick={() => handleDelete(url)}
                disabled={busy}
                title="Remove photo"
                aria-label="Remove photo"
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 hover:bg-red-500 text-white text-[10px] leading-none flex items-center justify-center disabled:opacity-50"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className={btnCls}>
          {busy ? 'Working…' : 'Upload photo'}
        </button>
        <button
          type="button"
          onClick={() => setShowUrlInput(v => !v)}
          disabled={busy}
          className={btnCls}
        >
          Use a URL
        </button>
      </div>

      {showUrlInput && (
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddUrl();
              }
            }}
            placeholder="https://example.com/photo.jpg"
            className={inputCls}
          />
          <button type="button" onClick={handleAddUrl} disabled={busy || !urlInput.trim()} className={btnCls}>
            Add
          </button>
        </div>
      )}

      <p className={hintCls}>JPEG, PNG or WebP, max 5 MB. The first photo shows on the booking widget.</p>
    </div>
  );
}
