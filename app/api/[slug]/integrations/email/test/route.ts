import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { getEmailContext, renderEmailHtml } from '@/lib/email';

// POST — send a test email to the signed-in agent using the tenant's resolved
// email context (Phase 19 A5). Doubles as a practical verification that the
// configured Resend key + sending domain actually deliver.
export async function POST() {
  let user;
  try {
    user = await requireRole(['agent']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!user.email) {
    return NextResponse.json({ error: 'No email address on your account' }, { status: 400 });
  }

  const ctx = await getEmailContext(user.tenantId);
  if (!ctx) {
    return NextResponse.json(
      { error: 'Email is not configured. Save a Resend API key and verified sending domain, then activate email.' },
      { status: 400 }
    );
  }

  const bodyText =
    `This is a test email from Book-IT.\n\n` +
    `If you received this, your email integration is working and bookings ` +
    `notifications will be delivered from this address.`;

  const result = await ctx.provider.sendEmail({
    to: user.email,
    fromName: ctx.fromName,
    subject: 'Book-IT test email',
    html: renderEmailHtml({
      bodyText,
      logoUrl: ctx.branding.logoUrl,
      brandColor: ctx.branding.brandColor,
      tenantName: ctx.branding.tenantName,
    }),
    text: bodyText,
    ...(ctx.replyTo ? { replyTo: ctx.replyTo } : {}),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: `Test email failed: ${result.error ?? 'unknown error'}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, sent_to: user.email });
}
