import { SupabaseClient } from '@supabase/supabase-js';

interface AnonymizeResult {
  success: boolean;
  alreadyAnonymized: boolean;
  bookingsAnonymized: number;
}

export async function anonymizeClient(
  supabase: SupabaseClient,
  tenantId: string,
  clientId: string,
  clientType: 'client' | 'guest_client'
): Promise<AnonymizeResult> {
  const table = clientType === 'client' ? 'clients' : 'guest_clients';
  const fkColumn = clientType === 'client' ? 'client_id' : 'guest_client_id';
  const nameField = clientType === 'client' ? 'display_name' : 'name';

  const { data: existing, error: fetchErr } = await supabase
    .from(table)
    .select('id, anonymized_at')
    .eq('id', clientId)
    .eq('tenant_id', tenantId)
    .single();

  if (fetchErr || !existing) {
    return { success: false, alreadyAnonymized: false, bookingsAnonymized: 0 };
  }

  if (existing.anonymized_at) {
    return { success: true, alreadyAnonymized: true, bookingsAnonymized: 0 };
  }

  const now = new Date().toISOString();

  const clientUpdate: Record<string, unknown> = {
    [nameField]: 'Deleted client',
    email: `deleted+${clientId}@anonymized.local`,
    phone: null,
    anonymized_at: now,
  };
  if (clientType === 'client') {
    clientUpdate.real_name = null;
    clientUpdate.status = 'suspended';
    clientUpdate.status_reason = 'GDPR erasure';
    clientUpdate.status_changed_at = now;
    clientUpdate.status_changed_by = 'system';
  }

  const { error: updateErr } = await supabase
    .from(table)
    .update(clientUpdate)
    .eq('id', clientId)
    .eq('tenant_id', tenantId);

  if (updateErr) {
    console.error('[gdpr:anonymize] client update error:', updateErr);
    return { success: false, alreadyAnonymized: false, bookingsAnonymized: 0 };
  }

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, custom_field_values')
    .eq(fkColumn, clientId)
    .eq('tenant_id', tenantId);

  let bookingsAnonymized = 0;
  if (bookings && bookings.length > 0) {
    for (const booking of bookings) {
      const cleanFields: Record<string, unknown> = {};
      if (booking.custom_field_values && typeof booking.custom_field_values === 'object') {
        for (const [key, val] of Object.entries(booking.custom_field_values as Record<string, unknown>)) {
          if (typeof val === 'string' && val.length > 0) {
            cleanFields[key] = '[redacted]';
          } else {
            cleanFields[key] = val;
          }
        }
      }

      await supabase
        .from('bookings')
        .update({
          booking_notes: null,
          service_address: null,
          location_address: null,
          location_notes: null,
          reference_image_url: null,
          custom_field_values: cleanFields,
        })
        .eq('id', booking.id)
        .eq('tenant_id', tenantId);

      bookingsAnonymized++;
    }
  }

  await supabase.from('notification_log').insert({
    tenant_id: tenantId,
    event_type: 'gdpr_anonymize',
    recipient_type: clientType,
    channel: 'in_platform',
    status: 'sent',
    sent_at: now,
  });

  return { success: true, alreadyAnonymized: false, bookingsAnonymized };
}
