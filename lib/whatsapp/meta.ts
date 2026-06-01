import type { WhatsAppProvider } from './types';

interface MetaConfig {
  accessToken: string;
  phoneNumberId: string;
}

export function createMetaProvider(config: MetaConfig): WhatsAppProvider {
  return {
    async sendMessage(to: string, body: string): Promise<boolean> {
      const toNumber = to.replace(/[^0-9]/g, '');

      try {
        const url = `https://graph.facebook.com/v20.0/${config.phoneNumberId}/messages`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: toNumber,
            type: 'text',
            text: { body },
          }),
        });

        if (!response.ok) {
          const err = await response.text();
          console.error('[whatsapp:meta] Send failed:', err);
          return false;
        }
        return true;
      } catch (err) {
        console.error('[whatsapp:meta] Network error:', err);
        return false;
      }
    },
  };
}
