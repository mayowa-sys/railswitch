// services/engine/src/rails/email-service.ts
//
// Transactional email service for payment notifications.
// Uses a pluggable transport ( SMTP, SendGrid, Postmark, etc.)
// Falls back to console logging when no transport is configured.

import { GlobalLogger } from '../utils/logger.js';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailTransport {
  send(msg: EmailMessage): Promise<boolean>;
}

class ConsoleTransport implements EmailTransport {
  async send(msg: EmailMessage): Promise<boolean> {
    console.log(`[email] To: ${msg.to} | Subject: ${msg.subject}`);
    console.log(`[email] Body: ${msg.text ?? msg.html.slice(0, 200)}`);
    return true;
  }
}

let _transport: EmailTransport | null = null;

export function getEmailTransport(): EmailTransport {
  if (_transport) return _transport;

  // SMTP
  if (process.env.SMTP_HOST) {
    // Dynamic import to avoid circular deps
    _transport = {
      send: async (msg) => {
        try {
          const nodemailer = await (Function('return import("nodemailer")')() as Promise<any>);
          const transport = nodemailer.default.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT ?? 587),
            secure: process.env.SMTP_SECURE === 'true',
            auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
          });
          await transport.sendMail({ from: process.env.SMTP_FROM ?? 'noreply@railswitch.io', to: msg.to, subject: msg.subject, html: msg.html, text: msg.text });
          return true;
        } catch (err) {
          console.error('[email] SMTP send failed:', err);
          return false;
        }
      },
    };
    return _transport;
  }

  // SendGrid
  if (process.env.SENDGRID_API_KEY) {
    _transport = {
      send: async (msg) => {
        try {
          const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: msg.to }] }],
              from: { email: process.env.SENDGRID_FROM ?? 'noreply@railswitch.io' },
              subject: msg.subject,
              content: [{ type: 'text/html', value: msg.html }, ...(msg.text ? [{ type: 'text/plain', value: msg.text }] : [])],
            }),
          });
          return res.ok;
        } catch (err) {
          console.error('[email] SendGrid send failed:', err);
          return false;
        }
      },
    };
    return _transport;
  }

  _transport = new ConsoleTransport();
  return _transport;
}

// ── Email Templates ──

export function paymentFailedEmail(opts: { customerName: string; planName: string; amount: number; portalLink: string; vaNumber?: string; bankName?: string }): EmailMessage {
  const amountText = `₦${opts.amount.toLocaleString()}`;
  const vaSection = opts.vaNumber
    ? `<p>Transfer <strong>${amountText}</strong> to:</p><p>Bank: ${opts.bankName ?? 'Nomba'}<br>Account: ${opts.vaNumber}<br>Reference: Your subscription ID</p>`
    : '';
  return {
    to: '', // filled by caller
    subject: `Payment Failed — ${opts.planName} Subscription`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2>Payment Failed</h2>
        <p>Hi ${opts.customerName},</p>
        <p>Your card payment of <strong>${amountText}</strong> for the <strong>${opts.planName}</strong> plan could not be processed.</p>
        ${vaSection}
        <p><a href="${opts.portalLink}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px">Update Payment Method</a></p>
        <p>If you don't update your payment method within 7 days, your subscription may be cancelled.</p>
        <p>— The RailSwitch Team</p>
      </div>
    `,
    text: `Payment Failed\n\nHi ${opts.customerName},\nYour card payment of ${amountText} for the ${opts.planName} plan could not be processed.\n${opts.vaNumber ? `Transfer ${amountText} to:\nBank: ${opts.bankName ?? 'Nomba'}\nAccount: ${opts.vaNumber}\n` : ''}Update your payment method: ${opts.portalLink}`,
  };
}

export function paymentRecoveredEmail(opts: { customerName: string; planName: string; amount: number }): EmailMessage {
  return {
    to: '',
    subject: `Payment Received — ${opts.planName} Subscription`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2>Payment Received</h2>
        <p>Hi ${opts.customerName},</p>
        <p>Your payment of <strong>₦${opts.amount.toLocaleString()}</strong> for the <strong>${opts.planName}</strong> plan has been received. Thank you!</p>
        <p>— The RailSwitch Team</p>
      </div>
    `,
    text: `Payment Received\n\nHi ${opts.customerName},\nYour payment of ₦${opts.amount.toLocaleString()} for the ${opts.planName} plan has been received. Thank you!`,
  };
}

export function subscriptionCancelledEmail(opts: { customerName: string; planName: string; portalLink: string }): EmailMessage {
  return {
    to: '',
    subject: `Subscription Cancelled — ${opts.planName}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2>Subscription Cancelled</h2>
        <p>Hi ${opts.customerName},</p>
        <p>Your <strong>${opts.planName}</strong> subscription has been cancelled due to non-payment.</p>
        <p>You can resubscribe anytime:</p>
        <p><a href="${opts.portalLink}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px">Resubscribe</a></p>
        <p>— The RailSwitch Team</p>
      </div>
    `,
    text: `Subscription Cancelled\n\nHi ${opts.customerName},\nYour ${opts.planName} subscription has been cancelled due to non-payment.\nResubscribe: ${opts.portalLink}`,
  };
}

export function dunningReminderEmail(opts: { customerName: string; planName: string; amount: number; portalLink: string; dayNumber: number }): EmailMessage {
  const urgency = opts.dayNumber >= 3 ? 'Urgent' : 'Reminder';
  const body = opts.dayNumber >= 3
    ? `<p>This is your final reminder. Your <strong>${opts.planName}</strong> subscription will be cancelled if payment is not received within 24 hours.</p>`
    : `<p>This is a friendly reminder that your payment for the <strong>${opts.planName}</strong> plan is overdue.</p>`;
  return {
    to: '',
    subject: `${urgency}: Payment Overdue — ${opts.planName}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2>${urgency}: Payment Overdue</h2>
        <p>Hi ${opts.customerName},</p>
        ${body}
        <p>Amount due: <strong>₦${opts.amount.toLocaleString()}</strong></p>
        <p><a href="${opts.portalLink}" style="display:inline-block;padding:12px 24px;background:#ef4444;color:#fff;text-decoration:none;border-radius:6px">Pay Now</a></p>
        <p>— The RailSwitch Team</p>
      </div>
    `,
    text: `${urgency}: Payment Overdue\n\nHi ${opts.customerName},\n${body.replace(/<[^>]+>/g, '')}\nAmount due: ₦${opts.amount.toLocaleString()}\nPay now: ${opts.portalLink}`,
  };
}
