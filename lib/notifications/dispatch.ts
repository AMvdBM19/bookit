import { createServiceClient } from '@/lib/supabase/server';
import { getWhatsAppProvider } from '@/lib/whatsapp';
import { resolveTemplate } from '@/lib/notifications/templates';
import { getEmailContext, renderEmailHtml, type EmailAttachment } from '@/lib/email';
import { buildIcsContent } from '@/lib/calendar/buildUrl';

interface NotificationOptions {
  tenantId: string;
  type: string;
  message: string;
  priority?: number;
  linkedEntity?: string;
  linkedId?: string;
}

export async function createNotification(opts: NotificationOptions) {
  const supabase = createServiceClient();

  const { error } = await supabase.from('agent_notifications').insert({
    tenant_id: opts.tenantId,
    type: opts.type,
    message: opts.message,
    priority: opts.priority ?? 3,
    linked_entity: opts.linkedEntity ?? null,
    linked_id: opts.linkedId ?? null,
    is_read: false,
    is_resolved: false,
  });

  if (error) {
    console.error('[notification] Failed to create:', error.message);
  }
}

interface WhatsAppOptions {
  tenantId: string;
  recipientPhone: string;
  eventType: string;
  variables: Record<string, string>;
  recipientType?: 'client' | 'guest_client' | 'staff' | 'agent';
  bookingId?: string;
}

export async function sendWhatsApp(opts: WhatsAppOptions): Promise<boolean> {
  const template = await resolveTemplate(opts.tenantId, opts.eventType, 'whatsapp', opts.variables);
  if (!template) return false;

  const provider = await getWhatsAppProvider(opts.tenantId);
  const sent = provider ? await provider.sendMessage(opts.recipientPhone, template.body) : false;

  const supabase = createServiceClient();
  await supabase.from('notification_log').insert({
    tenant_id: opts.tenantId,
    booking_id: opts.bookingId ?? null,
    event_type: opts.eventType,
    recipient_type: opts.recipientType ?? 'client',
    recipient_phone: opts.recipientPhone,
    channel: 'whatsapp',
    status: sent ? 'sent' : 'failed',
    sent_at: sent ? new Date().toISOString() : null,
  });

  return sent;
}

interface BookingEmailOptions {
  tenantId: string;
  bookingId: string;
  eventType: string;
  variables: Record<string, string>;
  /** Attach an .ics calendar invite (booking_confirmed emails). */
  attachIcs?: boolean;
}

/**
 * Email counterpart of sendWhatsApp for booking events (Phase 16-B3).
 * Self-contained: resolves the tenant's email integration, the (event,
 * 'email') template, and the recipient address from the booking row itself,
 * so WhatsApp callsites stay untouched. Never throws — email failures must
 * not block the WhatsApp send or the API response.
 */
export async function sendBookingEmail(opts: BookingEmailOptions): Promise<boolean> {
  try {
    // Cheapest gate first: tenants without an active email integration (the
    // default) exit before any further queries.
    const ctx = await getEmailContext(opts.tenantId);
    if (!ctx) return false;

    const supabase = createServiceClient();

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, client_id, guest_client_id, slot_date, slot_start, slot_end')
      .eq('id', opts.bookingId)
      .eq('tenant_id', opts.tenantId)
      .single();
    if (!booking) return false;

    let recipientEmail: string | null = null;
    let recipientType: 'client' | 'guest_client' = 'client';
    if (booking.client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('email')
        .eq('id', booking.client_id)
        .single();
      recipientEmail = client?.email ?? null;
    } else if (booking.guest_client_id) {
      const { data: guest } = await supabase
        .from('guest_clients')
        .select('email')
        .eq('id', booking.guest_client_id)
        .single();
      recipientEmail = guest?.email ?? null;
      recipientType = 'guest_client';
    }
    if (!recipientEmail) return false;

    // Service names are available to email templates as [services] without
    // requiring WhatsApp callsites to pass them.
    const { data: tagRows } = await supabase
      .from('booking_service_tags')
      .select('tag_name')
      .eq('booking_id', opts.bookingId);
    const serviceNames = (tagRows ?? []).map(t => t.tag_name).join(', ');
    const variables = { ...opts.variables, services: serviceNames || '—' };

    const template = await resolveTemplate(opts.tenantId, opts.eventType, 'email', variables);
    if (!template) return false;

    let attachments: EmailAttachment[] | undefined;
    // Manual bookings can be off-grid (no slot) — skip the invite then.
    if (opts.attachIcs && booking.slot_date && booking.slot_start && booking.slot_end) {
      const ics = buildIcsContent(
        {
          title: opts.variables.staff_name
            ? `Appointment with ${opts.variables.staff_name} — ${ctx.branding.tenantName}`
            : `Appointment — ${ctx.branding.tenantName}`,
          date: booking.slot_date,
          startTime: booking.slot_start.slice(0, 5),
          endTime: booking.slot_end.slice(0, 5),
          ...(serviceNames ? { description: `Services: ${serviceNames}` } : {}),
        },
        `bookit-${booking.id}`
      );
      attachments = [
        { filename: 'booking.ics', content: Buffer.from(ics, 'utf8').toString('base64') },
      ];
    }

    const result = await ctx.provider.sendEmail({
      to: recipientEmail,
      subject: template.subject ?? `Booking update — ${ctx.branding.tenantName}`,
      html: renderEmailHtml({ bodyText: template.body, ...ctx.branding }),
      text: template.body,
      attachments,
      replyTo: ctx.replyTo,
      fromName: ctx.fromName,
    });

    await supabase.from('notification_log').insert({
      tenant_id: opts.tenantId,
      booking_id: opts.bookingId,
      event_type: opts.eventType,
      recipient_type: recipientType,
      recipient_email: recipientEmail,
      channel: 'email',
      status: result.ok ? 'sent' : 'failed',
      sent_at: result.ok ? new Date().toISOString() : null,
    });

    return result.ok;
  } catch (err) {
    console.error('[email] dispatch error:', err);
    return false;
  }
}

export async function notifyBookingRequest(
  tenantId: string,
  bookingId: string,
  staffLabel: string,
  clientDisplayName: string,
  slotDate: string,
  slotStart: string
) {
  await createNotification({
    tenantId,
    type: 'booking_request',
    message: `New booking request for ${staffLabel} from ${clientDisplayName} on ${slotDate} at ${slotStart.slice(0, 5)}`,
    priority: 2,
    linkedEntity: 'booking',
    linkedId: bookingId,
  });
}

export async function notifyBookingConfirmed(
  tenantId: string,
  bookingId: string,
  recipientPhone: string | null,
  waOptIn: boolean,
  variables: Record<string, string>,
  recipientType: 'client' | 'guest_client' = 'client'
) {
  if (recipientPhone && waOptIn) {
    await sendWhatsApp({
      tenantId,
      recipientPhone,
      eventType: 'booking_confirmed',
      variables,
      recipientType,
      bookingId,
    });
  }
  await sendBookingEmail({
    tenantId,
    bookingId,
    eventType: 'booking_confirmed',
    variables,
    attachIcs: true,
  });
}

// BUG 5 FIX: Implemented WA dispatch on booking accept/decline (was TODO stub in Velours)
export async function notifyBookingDeclined(
  tenantId: string,
  bookingId: string,
  recipientPhone: string | null,
  waOptIn: boolean,
  variables: Record<string, string>,
  recipientType: 'client' | 'guest_client' = 'client'
) {
  if (recipientPhone && waOptIn) {
    await sendWhatsApp({
      tenantId,
      recipientPhone,
      eventType: 'booking_declined',
      variables,
      recipientType,
      bookingId,
    });
  }
  await sendBookingEmail({ tenantId, bookingId, eventType: 'booking_declined', variables });
}

export async function notifyBookingCancelled(
  tenantId: string,
  bookingId: string,
  recipientPhone: string | null,
  waOptIn: boolean,
  variables: Record<string, string>,
  recipientType: 'client' | 'guest_client' = 'client'
) {
  if (recipientPhone && waOptIn) {
    await sendWhatsApp({
      tenantId,
      recipientPhone,
      eventType: 'booking_cancelled',
      variables,
      recipientType,
      bookingId,
    });
  }
  await sendBookingEmail({ tenantId, bookingId, eventType: 'booking_cancelled', variables });
}

export async function notifyClientSignup(
  tenantId: string,
  clientId: string,
  displayName: string
) {
  await createNotification({
    tenantId,
    type: 'client_signup',
    message: `New client registration: ${displayName}. Review and approve or reject.`,
    priority: 1,
    linkedEntity: 'client',
    linkedId: clientId,
  });
}

export async function notifyClientApproved(
  tenantId: string,
  clientPhone: string | null,
  waOptIn: boolean,
  displayName: string
) {
  if (clientPhone && waOptIn) {
    await sendWhatsApp({
      tenantId,
      recipientPhone: clientPhone,
      eventType: 'client_approved',
      variables: { client_name: displayName },
      recipientType: 'client',
    });
  }
}

export async function notifyStaffOffline(
  tenantId: string,
  staffId: string,
  pseudonym: string,
  reason: string
) {
  await createNotification({
    tenantId,
    type: 'staff_offline',
    message: `${pseudonym} went offline: ${reason}`,
    priority: 2,
    linkedEntity: 'staff',
    linkedId: staffId,
  });
}

export async function notifyBlacklistFlag(
  tenantId: string,
  clientId: string,
  staffPseudonym: string,
  clientDisplayName: string,
  reason: string
) {
  await createNotification({
    tenantId,
    type: 'blacklist_flag',
    message: `${staffPseudonym} flagged ${clientDisplayName}: ${reason}`,
    priority: 1,
    linkedEntity: 'client',
    linkedId: clientId,
  });
}

export async function notifyNoShow(
  tenantId: string,
  bookingId: string,
  clientDisplayName: string,
  staffPseudonym: string
) {
  await createNotification({
    tenantId,
    type: 'booking_no_show',
    message: `No-show: ${clientDisplayName} did not appear for booking with ${staffPseudonym}`,
    priority: 2,
    linkedEntity: 'booking',
    linkedId: bookingId,
  });
}
