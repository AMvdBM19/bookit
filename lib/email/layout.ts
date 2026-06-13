// Shared minimal HTML layout for all outgoing tenant emails (Phase 16-B6).
// Table-based with inline styles for email-client compatibility. The only
// external resource is the tenant logo (when set) — no webfonts, no
// tracking pixels (GDPR posture).

interface EmailLayoutOptions {
  /** Plain-text body from the notification template (already interpolated). */
  bodyText: string;
  logoUrl: string | null;
  brandColor: string;
  tenantName: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderEmailHtml(opts: EmailLayoutOptions): string {
  const brand = /^#[0-9a-fA-F]{3,8}$/.test(opts.brandColor) ? opts.brandColor : '#2BB673';
  const bodyHtml = escapeHtml(opts.bodyText).replace(/\r?\n/g, '<br />');
  const logo = opts.logoUrl
    ? `<img src="${escapeHtml(opts.logoUrl)}" alt="${escapeHtml(opts.tenantName)}" height="40" style="display:block;height:40px;max-width:200px;object-fit:contain;" />`
    : `<span style="font-size:16px;font-weight:bold;color:#18181b;">${escapeHtml(opts.tenantName)}</span>`;

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#f4f4f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:94%;background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="height:4px;background-color:${brand};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px 32px;">${logo}</td>
          </tr>
          <tr>
            <td style="padding:16px 32px 28px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#3f3f46;">
              ${bodyHtml}
            </td>
          </tr>
        </table>
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:94%;">
          <tr>
            <td style="padding:16px 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#a1a1aa;" align="center">
              Sent via Book-IT
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
