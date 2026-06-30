import cron from 'node-cron';
import { createServiceClient } from '@/lib/supabase/server';
import { anonymizeClient } from '@/lib/gdpr/anonymize';

let started = false;

export function startRetentionCron() {
  if (started) return;

  if (process.env.ENABLE_RETENTION_CRON !== 'true') {
    console.log('[cron] Retention cron disabled (set ENABLE_RETENTION_CRON=true to enable)');
    return;
  }

  started = true;

  cron.schedule('0 4 * * *', async () => {
    try {
      await processRetention();
    } catch (err) {
      console.error('[cron:retention] Error:', err);
    }
  });

  console.log('[cron] Retention cron started (daily at 04:00)');
}

async function processRetention() {
  const supabase = createServiceClient();

  const { data: tenants, error } = await supabase
    .from('tenant_settings')
    .select('tenant_id, gdpr_retention_years')
    .gt('gdpr_retention_years', 0);

  if (error || !tenants) {
    console.error('[cron:retention] Failed to load tenant settings:', error?.message);
    return;
  }

  let totalAnonymized = 0;
  const BATCH_LIMIT = 50;

  for (const tenant of tenants) {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - tenant.gdpr_retention_years);
    const cutoff = cutoffDate.toISOString().split('T')[0];

    const { data: staleBookings } = await supabase
      .from('bookings')
      .select('client_id, guest_client_id')
      .eq('tenant_id', tenant.tenant_id)
      .lt('slot_date', cutoff)
      .in('status', ['completed', 'cancelled', 'no_show'])
      .limit(BATCH_LIMIT);

    if (!staleBookings || staleBookings.length === 0) continue;

    const clientIds = new Set<string>();
    const guestIds = new Set<string>();

    for (const b of staleBookings) {
      if (b.client_id) clientIds.add(b.client_id);
      if (b.guest_client_id) guestIds.add(b.guest_client_id);
    }

    for (const cid of Array.from(clientIds)) {
      const { data: recentBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('client_id', cid)
        .eq('tenant_id', tenant.tenant_id)
        .gte('slot_date', cutoff)
        .limit(1)
        .maybeSingle();

      if (recentBooking) continue;

      const result = await anonymizeClient(supabase, tenant.tenant_id, cid, 'client');
      if (result.success && !result.alreadyAnonymized) {
        totalAnonymized++;
        console.log(`[cron:retention] Anonymized client ${cid} for tenant ${tenant.tenant_id}`);
      }
    }

    for (const gid of Array.from(guestIds)) {
      const { data: recentBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('guest_client_id', gid)
        .eq('tenant_id', tenant.tenant_id)
        .gte('slot_date', cutoff)
        .limit(1)
        .maybeSingle();

      if (recentBooking) continue;

      const result = await anonymizeClient(supabase, tenant.tenant_id, gid, 'guest_client');
      if (result.success && !result.alreadyAnonymized) {
        totalAnonymized++;
        console.log(`[cron:retention] Anonymized guest ${gid} for tenant ${tenant.tenant_id}`);
      }
    }
  }

  if (totalAnonymized > 0) {
    console.log(`[cron:retention] Done. Anonymized ${totalAnonymized} record(s).`);
  }
}
