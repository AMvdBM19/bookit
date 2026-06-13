import type { EmailProvider, SendEmailOptions, SendEmailResult } from './types';

// Resend adapter using the REST API directly (https://resend.com/docs/api-reference/emails/send-email).
// No SDK: the send call is a single authenticated POST, so a dependency
// would buy nothing.

interface ResendConfig {
  apiKey: string;
  /** Verified sending address, e.g. bookings@mail.bookit.monoliet.cloud */
  fromAddress: string;
}

export function createResendProvider(config: ResendConfig): EmailProvider {
  return {
    async sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
      // RFC 5322 display name — strip quotes/control chars rather than escaping.
      const displayName = `${opts.fromName} via Book-IT`.replace(/["\\\r\n]/g, '').trim();

      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${displayName} <${config.fromAddress}>`,
            to: [opts.to],
            subject: opts.subject,
            html: opts.html,
            text: opts.text,
            ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
            ...(opts.attachments && opts.attachments.length > 0
              ? { attachments: opts.attachments }
              : {}),
          }),
        });

        const data = (await response.json().catch(() => ({}))) as {
          id?: string;
          message?: string;
        };

        if (!response.ok) {
          console.error('[email:resend] send failed:', response.status, data.message ?? data);
          return { ok: false, error: data.message ?? `HTTP ${response.status}` };
        }

        console.log('[email:resend] sent, message id:', data.id);
        return { ok: true, id: data.id };
      } catch (err) {
        console.error('[email:resend] network error:', err);
        return { ok: false, error: 'network error' };
      }
    },
  };
}
