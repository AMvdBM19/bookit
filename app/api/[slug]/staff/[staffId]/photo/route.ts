import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import type { AuthenticatedUser } from '@/lib/types/auth';

// Staff profile photos. Agents manage any staff member's photos; staff manage
// only their own (same ownership rule as the exceptions API). Files live in
// the public staff-photos bucket under {tenant_id}/{staff_id}/{uuid}.{ext}.

const BUCKET = 'staff-photos';
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_PHOTOS = 6;

async function authorize(staffId: string): Promise<AuthenticatedUser | NextResponse> {
  let user: AuthenticatedUser;
  try {
    user = await requireRole(['agent', 'staff']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.role === 'staff' && user.staffId !== staffId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return user;
}

async function loadStaff(tenantId: string, staffId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('staff')
    .select('id, tenant_id, photo_urls')
    .eq('id', staffId)
    .single();
  if (!data || data.tenant_id !== tenantId) return null;
  return data as { id: string; tenant_id: string; photo_urls: string[] | null };
}

// POST — upload a photo (multipart form, field "file") OR register an
// external photo URL (JSON body { url }). Returns the updated photo list.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; staffId: string }> }
) {
  const { staffId } = await params;
  const auth = await authorize(staffId);
  if (auth instanceof NextResponse) return auth;

  const staff = await loadStaff(auth.tenantId, staffId);
  if (!staff) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const existing = staff.photo_urls ?? [];
  if (existing.length >= MAX_PHOTOS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_PHOTOS} photos. Remove one first.` },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  let publicUrl: string;

  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG or WebP images are allowed' },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be 5 MB or smaller' }, { status: 400 });
    }

    const path = `${auth.tenantId}/${staffId}/${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type });

    if (uploadError) {
      console.error('[staff:photo] upload error:', uploadError);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } else {
    // URL fallback path.
    const body = await request.json().catch(() => null);
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!/^https?:\/\/.+/i.test(url) || url.length > 1000) {
      return NextResponse.json({ error: 'A valid http(s) image URL is required' }, { status: 400 });
    }
    publicUrl = url;
  }

  const nextUrls = [publicUrl, ...existing];
  const { error: updateError } = await supabase
    .from('staff')
    .update({ photo_urls: nextUrls })
    .eq('id', staffId)
    .eq('tenant_id', auth.tenantId);

  if (updateError) {
    console.error('[staff:photo] photo_urls update error:', updateError);
    return NextResponse.json({ error: 'Failed to save photo' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, photo_urls: nextUrls });
}

// DELETE — remove a photo. Body: { url }. Removes from photo_urls and, when
// the URL points into our bucket, deletes the storage object too.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; staffId: string }> }
) {
  const { staffId } = await params;
  const auth = await authorize(staffId);
  if (auth instanceof NextResponse) return auth;

  const staff = await loadStaff(auth.tenantId, staffId);
  if (!staff) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === 'string' ? body.url : '';
  const existing = staff.photo_urls ?? [];
  if (!url || !existing.includes(url)) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  }

  const supabase = createServiceClient();

  // Only delete storage objects we own (inside this staff member's folder).
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx !== -1) {
    const path = decodeURIComponent(url.slice(idx + marker.length));
    if (path.startsWith(`${auth.tenantId}/${staffId}/`)) {
      const { error: removeError } = await supabase.storage.from(BUCKET).remove([path]);
      if (removeError) {
        console.error('[staff:photo] storage remove error:', removeError);
      }
    }
  }

  const nextUrls = existing.filter(u => u !== url);
  const { error: updateError } = await supabase
    .from('staff')
    .update({ photo_urls: nextUrls.length > 0 ? nextUrls : null })
    .eq('id', staffId)
    .eq('tenant_id', auth.tenantId);

  if (updateError) {
    console.error('[staff:photo] photo_urls update error:', updateError);
    return NextResponse.json({ error: 'Failed to remove photo' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, photo_urls: nextUrls });
}
