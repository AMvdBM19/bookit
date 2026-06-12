import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';

// Returns a short-lived signed URL for a booking's reference image. The
// booking-references bucket is private; this is the only read path.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; bookingId: string }> }
) {
  const { bookingId } = await params;

  let user;
  try {
    user = await requireRole(['agent', 'staff']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, tenant_id, staff_id, reference_image_url')
    .eq('id', bookingId)
    .single();

  if (!booking || booking.tenant_id !== user.tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  // Staff may only view images for their own (or still unassigned) bookings.
  if (
    user.role === 'staff' &&
    booking.staff_id !== null &&
    booking.staff_id !== user.staffId
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!booking.reference_image_url) {
    return NextResponse.json({ error: 'No reference image' }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from('booking-references')
    .createSignedUrl(booking.reference_image_url, 3600);

  if (error || !data?.signedUrl) {
    console.error('[reference-image] sign error:', error);
    return NextResponse.json({ error: 'Failed to load image' }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
