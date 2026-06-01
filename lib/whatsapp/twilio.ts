import type { WhatsAppProvider } from './types';

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export function createTwilioProvider(config: TwilioConfig): WhatsAppProvider {
  return {
    async sendMessage(to: string, body: string): Promise<boolean> {
      const toNumber = to.replace(/[^0-9+]/g, '');
      const from = `whatsapp:${config.fromNumber}`;
      const toWa = `whatsapp:${toNumber}`;

      try {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
        const credentials = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ From: from, To: toWa, Body: body }).toString(),
        });

        if (!response.ok) {
          const err = await response.text();
          console.error('[whatsapp:twilio] Send failed:', err);
          return false;
        }
        return true;
      } catch (err) {
        console.error('[whatsapp:twilio] Network error:', err);
        return false;
      }
    },
  };
}
