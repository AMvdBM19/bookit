// Payment provider abstraction — mirrors lib/whatsapp + lib/email.

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'expired'
  | 'refunded'
  | 'cancelled';

export interface CreatePaymentInput {
  amount: number;
  currency: string;
  description: string;
  redirectUrl: string;
  webhookUrl: string;
  /** Optional preferred method (ideal, bancontact, …); omit to let the client choose. */
  method?: string;
  /** Echoed back by the provider and used to cross-check webhooks. */
  metadata?: Record<string, string>;
}

export interface CreateTerminalPaymentInput {
  amount: number;
  currency: string;
  description: string;
  /** Mollie point-of-sale terminal id (term_xxx). */
  terminalId: string;
  webhookUrl: string;
  /** Echoed back by the provider and used to cross-check webhooks. */
  metadata?: Record<string, string>;
}

export interface CreatedPayment {
  id: string;
  checkoutUrl: string | null;
  status: PaymentStatus;
}

export interface FetchedPayment {
  id: string;
  status: PaymentStatus;
  method: string | null;
  paidAt: string | null;
  /** Provider-reported amount, for webhook amount verification. */
  amount: number | null;
  currency: string | null;
  metadata: Record<string, string> | null;
}

export interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<CreatedPayment | null>;
  /**
   * Charge to a physical PIN terminal (point-of-sale). The client pays on the
   * reader, not via a hosted checkout, so the result is delivered by webhook
   * and there is no checkoutUrl. Returns null when the provider doesn't
   * support terminals or the call fails.
   */
  createTerminalPayment(input: CreateTerminalPaymentInput): Promise<CreatedPayment | null>;
  getPayment(id: string): Promise<FetchedPayment | null>;
}
