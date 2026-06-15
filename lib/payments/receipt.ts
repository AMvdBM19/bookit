import type { SupabaseClient } from '@supabase/supabase-js';

// Phase 18-B: booking receipt model. Shared by the receipt email (variables)
// and the downloadable HTML receipt. A receipt is NOT a tax invoice — when a
// tax rate is set we show a BTW breakdown for the customer's convenience with
// an explicit disclaimer.

export interface ReceiptServiceLine {
  name: string;
  extra: number;
}

export interface ReceiptData {
  bookingId: string;
  shortId: string;
  tenantName: string;
  clientName: string;
  date: string;
  time: string;
  staffName: string;
  services: ReceiptServiceLine[];
  serviceNames: string;
  total: number;
  depositPaid: number;
  /** Amount paid in the settling transaction (total - deposit, or full total). */
  amountPaid: number;
  paymentMethod: string | null;
  currency: string;
  taxRatePct: number;
  taxLabel: string;
  paidAt: string | null;
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency: currency || 'EUR' }).format(amount);
  } catch {
    return `${currency || 'EUR'} ${amount.toFixed(2)}`;
  }
}

/**
 * Assemble receipt data for a booking. Returns null only when the booking
 * can't be found. Tolerant of missing joins (separate queries + merge, per the
 * embedded-join gotcha).
 */
export async function buildReceiptData(
  supabase: SupabaseClient,
  tenantId: string,
  bookingId: string
): Promise<ReceiptData | null> {
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, tenant_id, staff_id, client_id, guest_client_id, slot_date, slot_start, total_price, deposit_amount, deposit_paid')
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!booking) return null;

  const [{ data: tenant }, { data: settings }, { data: tagRows }] = await Promise.all([
    supabase.from('tenants').select('name').eq('id', tenantId).maybeSingle(),
    supabase
      .from('tenant_settings')
      .select('currency, tax_rate_pct, tax_label, agency_display_name')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase.from('booking_service_tags').select('tag_name, extra_price').eq('booking_id', bookingId),
  ]);

  let staffName = '—';
  if (booking.staff_id) {
    const { data: staff } = await supabase
      .from('staff')
      .select('pseudonym')
      .eq('id', booking.staff_id)
      .maybeSingle();
    staffName = staff?.pseudonym ?? '—';
  }

  let clientName = 'Client';
  if (booking.client_id) {
    const { data: c } = await supabase.from('clients').select('display_name').eq('id', booking.client_id).maybeSingle();
    clientName = c?.display_name ?? clientName;
  } else if (booking.guest_client_id) {
    const { data: g } = await supabase.from('guest_clients').select('name').eq('id', booking.guest_client_id).maybeSingle();
    clientName = g?.name ?? clientName;
  }

  // Latest paid (or any) payment row, for method + paid timestamp.
  const { data: payments } = await supabase
    .from('payments')
    .select('method, paid_at, status, payment_type, created_at')
    .eq('booking_id', bookingId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  const settling = (payments ?? []).find(p => p.status === 'paid' && p.payment_type !== 'deposit')
    ?? (payments ?? []).find(p => p.status === 'paid')
    ?? (payments ?? [])[0]
    ?? null;

  const services: ReceiptServiceLine[] = (tagRows ?? []).map(t => ({
    name: t.tag_name,
    extra: Number(t.extra_price ?? 0),
  }));

  const total = Number(booking.total_price ?? 0);
  const depositPaid = booking.deposit_paid ? Number(booking.deposit_amount ?? 0) : 0;
  const amountPaid = Math.round((total - depositPaid) * 100) / 100;

  return {
    bookingId: booking.id,
    shortId: booking.id.slice(0, 8),
    tenantName: settings?.agency_display_name || tenant?.name || 'Booking',
    clientName,
    date: booking.slot_date,
    time: booking.slot_start ? booking.slot_start.slice(0, 5) : '',
    staffName,
    services,
    serviceNames: services.map(s => s.name).join(', ') || '—',
    total,
    depositPaid,
    amountPaid: amountPaid > 0 ? amountPaid : total,
    paymentMethod: settling?.method ?? null,
    currency: settings?.currency ?? 'EUR',
    taxRatePct: Number(settings?.tax_rate_pct ?? 0),
    taxLabel: settings?.tax_label || 'BTW',
    paidAt: settling?.paid_at ?? null,
  };
}

/** Variables for the payment_receipt notification template. */
export function receiptTemplateVariables(r: ReceiptData): Record<string, string> {
  const cur = r.currency;
  const depositLine = r.depositPaid > 0 ? `Deposit already paid: ${formatMoney(r.depositPaid, cur)}` : '';
  return {
    client_name: r.clientName,
    date: r.date,
    time: r.time,
    staff_name: r.staffName,
    services: r.serviceNames,
    total: formatMoney(r.total, cur),
    paid_amount: formatMoney(r.amountPaid, cur),
    payment_method: r.paymentMethod ?? 'card',
    deposit_line: depositLine,
    agency_name: r.tenantName,
  };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(date: string): string {
  const d = new Date(date + 'T00:00:00');
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Styled, self-contained HTML receipt for opening/printing in a new tab.
 * Shows a BTW breakdown (subtotal excl. / tax / total incl.) when a tax rate
 * is configured, with the "not a tax invoice" disclaimer.
 */
export function renderReceiptHtml(r: ReceiptData): string {
  const cur = r.currency;
  const hasTax = r.taxRatePct > 0;
  // total_price is the gross (tax-inclusive) amount; derive the breakdown.
  const totalIncl = r.total;
  const subtotalExcl = hasTax ? Math.round((totalIncl / (1 + r.taxRatePct / 100)) * 100) / 100 : totalIncl;
  const taxAmount = Math.round((totalIncl - subtotalExcl) * 100) / 100;

  const serviceRows =
    r.services.length === 0
      ? `<tr><td>${esc(r.serviceNames)}</td><td class="num"></td></tr>`
      : r.services
          .map(
            s =>
              `<tr><td>${esc(s.name)}</td><td class="num">${s.extra > 0 ? esc(formatMoney(s.extra, cur)) : ''}</td></tr>`
          )
          .join('');

  const taxBlock = hasTax
    ? `
      <tr class="sub"><td>Subtotal (excl. ${esc(r.taxLabel)})</td><td class="num">${esc(formatMoney(subtotalExcl, cur))}</td></tr>
      <tr class="sub"><td>${esc(r.taxLabel)} (${r.taxRatePct}%)</td><td class="num">${esc(formatMoney(taxAmount, cur))}</td></tr>
      <tr class="total"><td>Total (incl. ${esc(r.taxLabel)})</td><td class="num">${esc(formatMoney(totalIncl, cur))}</td></tr>`
    : `<tr class="total"><td>Total</td><td class="num">${esc(formatMoney(totalIncl, cur))}</td></tr>`;

  const depositRow =
    r.depositPaid > 0
      ? `<tr><td>Deposit already paid</td><td class="num">−${esc(formatMoney(r.depositPaid, cur))}</td></tr>`
      : '';

  const paidLabel = r.paidAt
    ? new Date(r.paidAt).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const disclaimer = hasTax
    ? 'This is a booking receipt, not a tax invoice. The figures are shown for your convenience.'
    : 'This is a booking receipt, not a tax invoice.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Receipt — ${esc(r.tenantName)} — ${esc(r.shortId)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f4f4f5; color: #18181b; margin: 0; padding: 32px 16px; }
  .receipt { max-width: 520px; margin: 0 auto; background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 32px; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .muted { color: #71717a; font-size: 13px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e4e4e7; }
  .meta { font-size: 13px; line-height: 1.7; margin-bottom: 24px; }
  .meta strong { display: inline-block; min-width: 92px; color: #52525b; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td { padding: 8px 0; }
  td.num { text-align: right; white-space: nowrap; }
  tr.sub td { color: #71717a; padding-top: 4px; padding-bottom: 4px; border-top: 1px dashed #e4e4e7; }
  tr.total td { font-weight: 700; font-size: 16px; border-top: 2px solid #18181b; padding-top: 12px; }
  .paid { margin-top: 24px; padding: 14px 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; font-size: 14px; }
  .paid b { color: #15803d; }
  .disclaimer { margin-top: 24px; font-size: 11px; color: #a1a1aa; line-height: 1.6; }
  .print-btn { display: block; margin: 0 auto 24px; max-width: 520px; }
  .print-btn button { width: 100%; padding: 10px; font-size: 14px; border: 1px solid #d4d4d8; border-radius: 8px; background: #fff; cursor: pointer; }
  @media print { body { background: #fff; padding: 0; } .receipt { border: none; } .print-btn { display: none; } }
</style>
</head>
<body>
<div class="print-btn"><button onclick="window.print()">Print / Save as PDF</button></div>
<div class="receipt">
  <div class="head">
    <div>
      <h1>${esc(r.tenantName)}</h1>
      <div class="muted">Booking receipt</div>
    </div>
    <div class="muted">#${esc(r.shortId)}</div>
  </div>

  <div class="meta">
    <div><strong>Customer</strong> ${esc(r.clientName)}</div>
    <div><strong>Date</strong> ${esc(fmtDate(r.date))}${r.time ? ' · ' + esc(r.time) : ''}</div>
    <div><strong>Served by</strong> ${esc(r.staffName)}</div>
    ${r.paymentMethod ? `<div><strong>Method</strong> ${esc(r.paymentMethod)}</div>` : ''}
  </div>

  <table>
    <tbody>
      ${serviceRows}
      ${taxBlock}
      ${depositRow}
    </tbody>
  </table>

  <div class="paid">
    <b>Paid: ${esc(formatMoney(r.amountPaid, cur))}</b>${paidLabel ? ` · ${esc(paidLabel)}` : ''}
  </div>

  <p class="disclaimer">${esc(disclaimer)}</p>
</div>
</body>
</html>`;
}
