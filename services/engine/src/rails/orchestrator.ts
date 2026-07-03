// services/engine/src/rails/orchestrator.ts
//
// Rail orchestrator scaffold.
//
// RESPONSIBILITY
// --------------
// Translates state machine entry events into rail-specific actions, and
// translates rail outcomes (success, failure, webhook receipt) back into
// state machine events.
//
// SCOPE OF THIS FILE (pre-window)
// -------------------------------
// Method stubs and the dependency-injection shape. No real cascade wiring,
// no retry timing, no webhook listeners. Each method logs what it would do
// and returns. The full implementation lands in the window phase.
//
// IMPORTANT
// ---------
// Like the state machine, this is internal-only logic. The orchestrator
// does not perform DB writes — it asks the wrapper (separate, not yet
// written) to persist the resulting state machine events.

import type { NombaClient } from './nomba-client.js';
import type { SubscriptionContext } from '../state-machines/subscription.js';
import { getWhatsAppService } from './whatsapp-service.js';
import { getEmailTransport, paymentFailedEmail, paymentRecoveredEmail, subscriptionCancelledEmail, dunningReminderEmail } from './email-service.js';
import { generatePortalLink } from '../routes/portal.js';
import { db } from '../db/client.js';
import { CustomersTable } from '../schema/customers.schema.js';
import { SubscriptionsTable } from '../schema/subscriptions.schema.js';
import { InvoicesTable } from '../schema/invoices.schema.js';
import { PlansTable } from '../schema/plans.schema.js';
import { eq } from 'drizzle-orm';

export interface OrchestratorLogger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

const consoleLogger: OrchestratorLogger = {
  info: (msg, meta) => console.log(`[orchestrator] ${msg}`, meta ?? ''),
  warn: (msg, meta) => console.warn(`[orchestrator] ${msg}`, meta ?? ''),
  error: (msg, meta) => console.error(`[orchestrator] ${msg}`, meta ?? ''),
};

export interface OrchestratorDeps {
  nomba: NombaClient;
  logger?: OrchestratorLogger;
}

export interface AttemptChargeInput {
  context: SubscriptionContext;
  paymentMethodToken: string;
  amount: number;
  /** Unique per (subscription, cycle, retry-attempt). */
  idempotencyKey: string;
}

export interface CreateVAInput {
  context: SubscriptionContext;
  amount: number;
  invoiceId: string;
  expiresInDays: number;
}

export interface SendUSSDInput {
  context: SubscriptionContext;
  amount: number;
  invoiceId: string;
  customerBankCode: string;
  customerPhone: string;
}

export interface SendRefundInput {
  amount: number;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  senderName: string;
  narration: string;
  merchantTxRef: string;
}

export class RailOrchestrator {
  private readonly nomba: NombaClient;
  private readonly logger: OrchestratorLogger;

  constructor(deps: OrchestratorDeps) {
    this.nomba = deps.nomba;
    this.logger = deps.logger ?? consoleLogger;
  }

  /**
   * Called when the state machine enters `charging`. Attempts the card charge
   * via Nomba and returns the result. The wrapper translates the result into
   * a CHARGE_SUCCEEDED or CHARGE_FAILED event and sends it to the actor.
   */
  async attemptCharge(input: AttemptChargeInput) {
    this.logger.info('attemptCharge', {
      subscriptionId: input.context.subscriptionId,
      idempotencyKey: input.idempotencyKey,
      retryCount: input.context.retryCount,
    });
    return this.nomba.chargeCard({
      token: input.paymentMethodToken,
      amount: input.amount,
      currency: 'NGN',
      customerId: input.context.customerId,
      merchantTxRef: input.idempotencyKey,
    });
  }

  /**
   * Called when the state machine enters `va_fallback`. Creates a one-time VA
   * scoped to this invoice. The wrapper persists vaId / expiresAt to context
   * via the VA_CREATED event.
   */
  async createVirtualAccount(input: CreateVAInput) {
    this.logger.info('createVirtualAccount', {
      subscriptionId: input.context.subscriptionId,
      invoiceId: input.invoiceId,
    });
    return this.nomba.createVirtualAccount({
      amount: input.amount,
      currency: 'NGN',
      reference: input.invoiceId,
      expiresInDays: input.expiresInDays,
      beneficiaryName: `RailSwitch-${input.context.merchantId.slice(0, 8)}`,
    });
  }

  /**
   * Called when the state machine enters `ussd_fallback`. Triggers a USSD
   * push. If the underlying client throws UnsupportedRailError, the wrapper
   * is expected to immediately advance the machine to `whatsapp_fallback`.
   */
  async sendUSSDPush(input: SendUSSDInput) {
    this.logger.info('sendUSSDPush', {
      subscriptionId: input.context.subscriptionId,
      invoiceId: input.invoiceId,
    });
    return this.nomba.triggerUSSD({
      amount: input.amount,
      currency: 'NGN',
      reference: input.invoiceId,
      customerBankCode: input.customerBankCode,
      customerPhone: input.customerPhone,
    });
  }

  /**
   * Called when the state machine enters `whatsapp_fallback`. Sends a
   * templated WhatsApp message with VA details + USSD code + checkout link.
   * Real implementation lands in the window phase (WhatsApp Cloud API).
   */
  async sendWhatsAppRecovery(input: { context: SubscriptionContext; invoiceId: string }) {
    this.logger.info('sendWhatsAppRecovery', {
      subscriptionId: input.context.subscriptionId,
      invoiceId: input.invoiceId,
    });

    const wa = getWhatsAppService();
    if (!wa) {
      this.logger.warn('WhatsApp not configured — skipping recovery message', {
        subscriptionId: input.context.subscriptionId,
      });
      return;
    }

    const [subscription] = await db
      .select()
      .from(SubscriptionsTable)
      .where(eq(SubscriptionsTable.id, input.context.subscriptionId))
      .limit(1);

    const [customer] = await db
      .select()
      .from(CustomersTable)
      .where(eq(CustomersTable.id, input.context.customerId))
      .limit(1);

    const [invoice] = await db
      .select()
      .from(InvoicesTable)
      .where(eq(InvoicesTable.id, input.invoiceId))
      .limit(1);

    const portalLink = generatePortalLink(customer.id, customer.merchant_id);

    const sent = await wa.sendRecoveryMessage({
      to: customer?.phone ?? '2348000000000',
      accountNumber: subscription?.va_id ?? undefined,
      bankName: 'Nomba',
      amount: invoice ? Number(invoice.amount) : undefined,
      reference: input.invoiceId,
      paymentLink: portalLink,
    });

    this.logger.info(sent ? 'WhatsApp recovery sent' : 'WhatsApp recovery failed to send', {
      subscriptionId: input.context.subscriptionId,
    });
  }

  /**
   * Revoke a stored card token. Called when a customer removes a payment method.
   */
  async revokePaymentMethod(tokenId: string) {
    this.logger.info('revokePaymentMethod', { tokenId });
    await this.nomba.revokeCardToken(tokenId);
  }

  /**
   * Send payment failed email to customer.
   */
  async sendPaymentFailedEmail(input: { customerId: string; merchantId: string; invoiceId: string; amount: number }) {
    const email = getEmailTransport();
    const [customer] = await db.select().from(CustomersTable).where(eq(CustomersTable.id, input.customerId)).limit(1);
    const [invoice] = await db.select().from(InvoicesTable).where(eq(InvoicesTable.id, input.invoiceId)).limit(1);
    const [sub] = await db.select().from(SubscriptionsTable).where(eq(SubscriptionsTable.id, invoice?.subscription_id ?? '')).limit(1);
    const [plan] = await db.select().from(PlansTable).where(eq(PlansTable.id, sub?.plan_id ?? '')).limit(1);

    if (!customer || !plan) return;

    const portalLink = generatePortalLink(customer.id, input.merchantId);
    const msg = paymentFailedEmail({
      customerName: customer.name,
      planName: plan.name,
      amount: input.amount,
      portalLink,
      vaNumber: sub?.va_id ?? undefined,
    });
    msg.to = customer.email;
    await email.send(msg);
  }

  /**
   * Send payment recovered email to customer.
   */
  async sendPaymentRecoveredEmail(input: { customerId: string; merchantId: string; invoiceId: string; amount: number }) {
    const email = getEmailTransport();
    const [customer] = await db.select().from(CustomersTable).where(eq(CustomersTable.id, input.customerId)).limit(1);
    const [invoice] = await db.select().from(InvoicesTable).where(eq(InvoicesTable.id, input.invoiceId)).limit(1);
    const [sub] = await db.select().from(SubscriptionsTable).where(eq(SubscriptionsTable.id, invoice?.subscription_id ?? '')).limit(1);
    const [plan] = await db.select().from(PlansTable).where(eq(PlansTable.id, sub?.plan_id ?? '')).limit(1);

    if (!customer || !plan) return;

    const msg = paymentRecoveredEmail({ customerName: customer.name, planName: plan.name, amount: input.amount });
    msg.to = customer.email;
    await email.send(msg);
  }

  /**
   * Send subscription cancelled email.
   */
  async sendSubscriptionCancelledEmail(input: { customerId: string; merchantId: string }) {
    const email = getEmailTransport();
    const [customer] = await db.select().from(CustomersTable).where(eq(CustomersTable.id, input.customerId)).limit(1);
    if (!customer) return;

    const portalLink = generatePortalLink(customer.id, input.merchantId);
    const msg = subscriptionCancelledEmail({ customerName: customer.name, planName: 'Your', portalLink });
    msg.to = customer.email;
    await email.send(msg);
  }

  /**
   * Send dunning reminder email.
   */
  async sendDunningReminder(input: { customerId: string; merchantId: string; invoiceId: string; amount: number; dayNumber: number }) {
    const email = getEmailTransport();
    const [customer] = await db.select().from(CustomersTable).where(eq(CustomersTable.id, input.customerId)).limit(1);
    const [invoice] = await db.select().from(InvoicesTable).where(eq(InvoicesTable.id, input.invoiceId)).limit(1);
    const [sub] = await db.select().from(SubscriptionsTable).where(eq(SubscriptionsTable.id, invoice?.subscription_id ?? '')).limit(1);
    const [plan] = await db.select().from(PlansTable).where(eq(PlansTable.id, sub?.plan_id ?? '')).limit(1);

    if (!customer || !plan) return;

    const portalLink = generatePortalLink(customer.id, input.merchantId);
    const msg = dunningReminderEmail({
      customerName: customer.name,
      planName: plan.name,
      amount: input.amount,
      portalLink,
      dayNumber: input.dayNumber,
    });
    msg.to = customer.email;
    await email.send(msg);
  }

  /**
   * Resolve a bank account number to a verified account name.
   * Required before initiating a refund transfer.
   */
  async lookupBankForRefund(bankCode: string, accountNumber: string) {
    this.logger.info('lookupBankForRefund', { bankCode, accountNumber });
    return this.nomba.lookupBankAccount(bankCode, accountNumber);
  }

  /**
   * Initiate a bank transfer for a refund or payout.
   * Always call lookupBankForRefund first to verify the recipient.
   */
  async sendRefund(input: SendRefundInput) {
    this.logger.info('sendRefund', { merchantTxRef: input.merchantTxRef });
    return this.nomba.sendTransfer({
      amount: input.amount,
      currency: 'NGN',
      bankCode: input.bankCode,
      accountNumber: input.accountNumber,
      accountName: input.accountName,
      senderName: input.senderName,
      narration: input.narration,
      merchantTxRef: input.merchantTxRef,
    });
  }
}
