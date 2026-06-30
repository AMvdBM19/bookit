import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

const BUCKET = 'booking-references';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; bookingId: string }> }
) {
  const { bookingId } = await params;
  const key = request.nextUrl.searchParams.get('key');

  if (!key) {
    return NextResponse.json({ error: 'key query param required' }, { status: 400 });
  }

  let user;
  try {
    user = await requireRole(['agent', 'staff']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, tenant_id, staff_id, reference_image_url, custom_field_values')
    .eq('id', bookingId)
    .single();

  if (!booking || booking.tenant_id !== user.tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (
    user.role === 'staff' &&
    booking.staff_id !== null &&
    booking.staff_id !== user.staffId
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let storagePath: string | null = null;

  if (key === 'reference_image') {
    storagePath = booking.reference_image_url ?? null;
  } else {
    const cfv = (booking.custom_field_values ?? {}) as Record<string, unknown>;
    const value = cfv[key];
    if (typeof value === 'string' && value.includes('/')) {
      storagePath = value;
    }
  }

  if (!storagePath) {
    return NextResponse.json({ error: 'No file found for this key' }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) {
    console.error('[booking-file] sign error:', error);
    return NextResponse.json({ error: 'Failed to generate file URL' }, { status: 500 });
  }

  const filename = storagePath.split('/').pop() ?? 'file';
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  const contentType = IMAGE_EXTS.includes(ext)
    ? `image/${ext === 'jpg' ? 'jpeg' : ext}`
    : ext === 'pdf'
      ? 'application/pdf'
      : 'application/octet-stream';

  return NextResponse.json({
    url: data.signedUrl,
    filename,
    content_type: contentType,
  });
}
