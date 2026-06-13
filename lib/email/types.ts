// Email provider abstraction — mirrors lib/whatsapp/types.ts.

export interface EmailAttachment {
  filename: string;
  /** Base64-encoded file content. */
  content: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
  /** Display name for the From header; the address itself is platform-global. */
  fromName: string;
}

export interface SendEmailResult {
  ok: boolean;
  /** Provider message ID when the send was accepted. */
  id?: string;
  error?: string;
}

export interface EmailProvider {
  sendEmail(opts: SendEmailOptions): Promise<SendEmailResult>;
}
