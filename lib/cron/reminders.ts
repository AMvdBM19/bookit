import cron from 'node-cron';
import { createServiceClient } from '@/lib/supabase/server';
import { sendWhatsApp, sendBookingEmail } from '@/lib/notifications/dispatch';

let started = false;

/**
 * T-minus reminder cron job.
 * Runs every 5 minutes. Finds confirmed bookings where slot time is within
 * reminder_lead_time_minutes from now, and reminder has not yet been sent.
 * Sends WA via Twilio and marks reminder_sent = true.
 */
export function startReminderCron() {
  if (started) return;

  const isEnabled =
    process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true';

  if (!isEnabled) {
    console.log('[cron] Reminder cron disabled (set ENABLE_CRON=true to enable in dev)');
    return;
  }

  started = true;

  cron.schedule('*/5 * * * *', async () => {
    try {
      await processReminders();
    } catch (err) {
      console.error('[cron:reminders] Error:', err);
    }
  });

  console.log('[cron] Reminder cron started (every 5 minutes)');
}

async function processReminders() {
  const supabase = createServiceClient();
  const now = new Date();

  // Fetch confirmed bookings with unprocessed reminders
  // We join tenant_settings to get reminder_lead_time_minutes per tenant
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(`
      id,
      tenant_id,
      staff_id,
      client_id,
      guest_client_id,
      slot_date,
      slot_start,
      slot_end,
      reminder_sent,
      tenant_settings!inner(reminder_lead_time_minutes),
      staff(pseudonym),
      clients(phone, wa_opt_in, display_name),
      guest_clients(phone, wa_opt_in, name)
    `)
    .eq('status', 'confirmed')
    .eq('reminder_sent', false);

  if (error) {
    console.error('[cron:reminders] Query error:', error.message);
    return;
  }

  if (!bookings || bookings.length === 0) return;

  for (const booking of bookings) {
    // Supabase returns joined rows as arrays — take first element
    const settingsArr = booking.tenant_settings as unknown as Array<{ reminder_lead_time_minutes: number }>;
    const settings = Array.isArray(settingsArr) ? settingsArr[0] : (settingsArr as unknown as { reminder_lead_time_minutes: number });
    if (!settings) continue;

    const leadMinutes = settings.reminder_lead_time_minutes;

    const slotDateTime = new Date(`${booking.slot_date}T${booking.slot_start}`);
    const minutesUntilSlot = (slotDateTime.getTime() - now.getTime()) / (1000 * 60);

    // Fire if slot is within the lead window but has not passed yet
    if (minutesUntilSlot < 0 || minutesUntilSlot > leadMinutes) continue;

    const staffArr = booking.staff as unknown as Array<{ pseudonym: string }> | { pseudonym: string } | null;
    const staff = Array.isArray(staffArr) ? staffArr[0] ?? null : staffArr ?? null;
    const clientArr = booking.clients as unknown as Array<{ phone: string | null; wa_opt_in: boolean; display_name: string }>;
    const client = Array.isArray(clientArr) ? clientArr[0] ?? null : (clientArr as unknown as { phone: string | null; wa_opt_in: boolean; display_name: string } | null);
    const guestArr = booking.guest_clients as unknown as Array<{ phone: string | null; wa_opt_in: boolean; name: string }>;
    const guest = Array.isArray(guestArr) ? guestArr[0] ?? null : (guestArr as unknown as { phone: string | null; wa_opt_in: boolean; name: string } | null);

    const recipientPhone = client?.phone ?? guest?.phone ?? null;
    const waOptIn = client?.wa_opt_in ?? guest?.wa_opt_in ?? false;
    const clientName = client?.display_name ?? guest?.name ?? 'Client';
    const recipientType = client ? 'client' : 'guest_client';

    const reminderVariables = {
      client_name: clientName,
      staff_name: staff?.pseudonym ?? '',
      date: booking.slot_date,
      time: booking.slot_start.slice(0, 5),
    };

    if (recipientPhone && waOptIn) {
      await sendWhatsApp({
        tenantId: booking.tenant_id,
        recipientPhone,
        eventType: 'booking_reminder',
        variables: reminderVariables,
        recipientType: recipientType as 'client' | 'guest_client',
        bookingId: booking.id,
      });
    }

    // Email reminder in the same pass — one reminder_sent flag for both
    // channels, set once below (no per-channel retries).
    await sendBookingEmail({
      tenantId: booking.tenant_id,
      bookingId: booking.id,
      eventType: 'booking_reminder',
      variables: reminderVariables,
    });

    // Mark reminder as sent regardless of channel success (avoid retrying)
    await supabase
      .from('bookings')
      .update({ reminder_sent: true, reminder_sent_at: now.toISOString() })
      .eq('id', booking.id);

    console.log(`[cron:reminders] Processed reminder for booking ${booking.id}`);
  }
}
