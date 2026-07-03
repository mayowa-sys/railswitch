// services/engine/src/rails/whatsapp-service.ts
//
// WhatsApp Cloud API integration — Meta test number.
//
// Sends templated recovery messages when the cascade reaches
// the WhatsApp fallback stage. Uses Meta's test phone number
// which works instantly for up to 5 pre-verified recipients.
//
// Landed: July 1 2026 (hackathon window)

import { GlobalLogger } from '../utils/logger.js';

export interface WhatsAppMessage {
  /** Customer phone number in international format (234xxxxxxxxxx) */
  to: string;
  /** VA account number for bank transfer */
  accountNumber?: string;
  /** Nomba bank name */
  bankName?: string;
  /** Amount to pay in Naira */
  amount?: number;
  /** Invoice or subscription reference */
  reference: string;
  /** Retry/checkout link */
  paymentLink?: string;
}

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  baseUrl?: string;
}

export class WhatsAppService {
  private readonly phoneNumberId: string;
  private readonly accessToken: string;
  private readonly baseUrl: string;
  private readonly logger: GlobalLogger;

  constructor(config: WhatsAppConfig) {
    this.phoneNumberId = config.phoneNumberId;
    this.accessToken = config.accessToken;
    this.baseUrl = config.baseUrl ?? 'https://graph.facebook.com/v21.0';
    this.logger = new GlobalLogger('WhatsAppService');
  }

  /**
   * Send a payment recovery message via WhatsApp Cloud API.
   */
  async sendRecoveryMessage(msg: WhatsAppMessage): Promise<boolean> {
    if (!this.phoneNumberId || !this.accessToken) {
      this.logger.warn('WhatsApp not configured — skipping message', { reference: msg.reference });
      return false;
    }

    const body = this.buildRecoveryBody(msg);

    try {
      const res = await fetch(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );

      const json = await res.json() as Record<string, unknown>;

      if (res.ok) {
        this.logger.info('WhatsApp recovery message sent', {
          to: msg.to,
          reference: msg.reference,
          messageId: json.messages
            ? (json.messages as Array<Record<string, unknown>>)[0]?.id
            : undefined,
        });
        return true;
      }

      this.logger.error('WhatsApp API error', new Error(JSON.stringify(json)), {
        status: res.status,
        reference: msg.reference,
      });
      return false;
    } catch (err) {
      this.logger.error('WhatsApp send failed', err as Error, { reference: msg.reference });
      return false;
    }
  }

  private buildRecoveryBody(msg: WhatsAppMessage) {
    const amountText = msg.amount ? `₦${msg.amount.toLocaleString()}` : 'your outstanding balance';
    const vaLine = msg.accountNumber
      ? `Transfer ${amountText} to:\nBank: ${msg.bankName ?? 'Nomba'}\nAccount: ${msg.accountNumber}\nRef: ${msg.reference}`
      : `Please complete your payment of ${amountText}`;

    const bodyText = [
      `*Payment Recovery — RailSwitch*`,
      ``,
      `Your recent card payment could not be processed.`,
      ``,
      vaLine,
      ``,
      msg.paymentLink ? `Or pay online: ${msg.paymentLink}` : '',
      ``,
      `Need help? Reply to this message.`,
      `Ref: ${msg.reference}`,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: msg.to,
      type: 'text',
      text: {
        preview_url: false,
        body: bodyText,
      },
    };
  }
}

/** Singleton lazily created from env vars. */
let _instance: WhatsAppService | null = null;

export function getWhatsAppService(): WhatsAppService | null {
  if (_instance) return _instance;
  if (process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN) {
    _instance = new WhatsAppService({
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    });
    return _instance;
  }
  return null;
}
