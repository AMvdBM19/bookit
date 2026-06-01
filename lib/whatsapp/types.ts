export interface WhatsAppProvider {
  sendMessage(to: string, body: string): Promise<boolean>;
}

export type WhatsAppProviderType = 'twilio_whatsapp' | 'meta_whatsapp';
