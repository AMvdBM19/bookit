import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { buildReceiptData, renderReceiptHtml } from '@/lib/payments/receipt';

// Phase 18-B3: downloadable HTML receipt for a booking. Agent/staff only.
// Returns styled HTML (opened in a new tab; the page has a Print/Save-as-PDF
// button). Shows a BTW breakdown when the tenant has a tax rate configured.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; bookingId: string }> }
) {
  const { bookingId } = await params;

  let user;
  try {
    user = await requireRole(['agent', 'staff']);
  } catch {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = createServiceClient();
  const receipt = await buildReceiptData(supabase, user.tenantId, bookingId);
  if (!receipt) {
    return new NextResponse('Booking not found', { status: 404 });
  }

  return new NextResponse(renderReceiptHtml(receipt), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
