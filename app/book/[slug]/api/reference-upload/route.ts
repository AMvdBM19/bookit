import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import type { FeatureFlags } from '@/lib/types/tenant-config';
import { DEFAULT_FEATURE_FLAGS } from '@/lib/types/tenant-config';
import { checkUploadRateLimit } from '@/lib/rate-limit/upload';

// Public (unauthenticated) upload of a booking reference image, only for
// tenants with the booking_reference_image flag. The file lands in the
// private booking-references bucket; the response returns the object path,
// which the book API stores on the booking. Display is via signed URLs on
// the authenticated dashboard side only.

const BUCKET = 'booking-references';
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
  const rateLimit = checkUploadRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many uploads. Please try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
    );
  }

  const supabase = createServiceClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, is_active')
    .eq('slug', slug)
    .single();

  if (!tenant || !tenant.is_active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Available when the tenant has at least one active file-type booking field
  // (Phase 20-C), or — for back-compat — the legacy reference-image flag.
  const [{ data: fileField }, { data: tenantConfig }] = await Promise.all([
    supabase
      .from('booking_fields')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('field_type', 'file')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('tenant_config')
      .select('feature_flags')
      .eq('tenant_id', tenant.id)
      .maybeSingle(),
  ]);

  const featureFlags =
    (tenantConfig?.feature_flags as FeatureFlags | undefined) ?? DEFAULT_FEATURE_FLAGS;
  if (!fileField && !featureFlags.booking_reference_image) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

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

  const path = `${tenant.id}/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type });

  if (uploadError) {
    console.error('[reference-upload] error:', uploadError);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path });
}
