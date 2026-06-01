import { createServiceClient } from '@/lib/supabase/server';
import { sendWhatsAppMessage, resolveTemplate } from '@/lib/twilio/dispatch';

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
  const body = await resolveTemplate(opts.tenantId, opts.eventType, 'whatsapp', opts.variables);
  if (!body) return false;

  const sent = await sendWhatsAppMessage(opts.tenantId, opts.recipientPhone, body);

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
