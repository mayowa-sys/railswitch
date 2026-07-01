// services/engine/src/rails/cascade-coordinator.ts
//
// Cascade Coordinator — drives the multi-rail dunning cascade.
//
// When a card charge fails, this coordinator advances the subscription
// through retry → VA fallback → WhatsApp fallback → past_due.
// Each cascade step is driven via BullMQ delayed jobs for proper timing.
//
// Landed: July 1 2026 (hackathon window)

import { BillingHandler, type BillingResult } from './billing-handler.js';
import { RailOrchestrator } from './orchestrator.js';
import { SubscriptionWrapper } from '../wrapper/subscription-wrapper.js';
import { BillingsQueue } from '../queues/billings.queue.js';
import { GlobalLogger } from '../utils/logger.js';
import { nextRetryAt } from './retry-timing.js';
import type { DunningPolicy, SubscriptionContext } from '../state-machines/subscription.js';
import { db } from '../db/client.js';
import { SubscriptionsTable } from '../schema/subscriptions.schema.js';
import { InvoicesTable } from '../schema/invoices.schema.js';
import { DrizzleSubscriptionRepository } from '../db/drizzle-repository.js';
import { eq } from 'drizzle-orm';

export interface CascadeCoordinatorDeps {
  billingHandler: BillingHandler;
  orchestrator: RailOrchestrator;
  logger?: GlobalLogger;
}

export class CascadeCoordinator {
  private readonly billingHandler: BillingHandler;
  private readonly orchestrator: RailOrchestrator;
  private readonly logger: GlobalLogger;

  constructor(deps: CascadeCoordinatorDeps) {
    this.billingHandler = deps.billingHandler;
    this.orchestrator = deps.orchestrator;
    this.logger = deps.logger ?? new GlobalLogger('CascadeCoordinator');
  }

  /**
   * Main entry point for a billing cycle. Attempts the card charge and
   * handles the cascade progression if it fails.
   */
  async processBillingCycle(input: {
    subscriptionId: string;
    invoiceId: string;
    amount: number;
    paymentMethodToken: string;
    idempotencyKey: string;
  }): Promise<BillingResult> {
    const result = await this.billingHandler.bill({
      subscriptionId: input.subscriptionId,
      invoiceId: input.invoiceId,
      amount: input.amount,
      paymentMethodToken: input.paymentMethodToken,
      idempotencyKey: input.idempotencyKey,
    });

    if (result.status === 'failed') {
      await this.handleFailedCharge(input.subscriptionId, input.invoiceId, input.amount, result.context);
    }

    return result;
  }

  /**
   * Handles a retry attempt. Same charge flow but triggered by RETRY_DUE.
   */
  async processRetry(input: {
    subscriptionId: string;
    invoiceId: string;
    amount: number;
    paymentMethodToken: string;
    idempotencyKey: string;
  }): Promise<BillingResult> {
    const result = await this.billingHandler.retry({
      subscriptionId: input.subscriptionId,
      invoiceId: input.invoiceId,
      amount: input.amount,
      paymentMethodToken: input.paymentMethodToken,
      idempotencyKey: input.idempotencyKey,
    });

    if (result.status === 'failed') {
      await this.handleFailedCharge(input.subscriptionId, input.invoiceId, input.amount, result.context);
    }

    return result;
  }

  /**
   * After a charge failure, decide: retry, VA fallback, or WhatsApp fallback.
   */
  private async handleFailedCharge(
    subscriptionId: string,
    invoiceId: string,
    amount: number,
    context: SubscriptionContext,
  ) {
    const policy = context.policy as DunningPolicy;

    // Reload subscription to get current state after state machine transition
    const [sub] = await db
      .select()
      .from(SubscriptionsTable)
      .where(eq(SubscriptionsTable.id, subscriptionId))
      .limit(1);

    if (!sub) return;

    if (sub.state === 'retrying') {
      await this.scheduleRetry(subscriptionId, invoiceId, amount, sub.retry_count, policy);
    } else if (sub.state === 'va_fallback') {
      await this.initiateVAFallback(subscriptionId, invoiceId, amount, sub.merchant_id);
    } else if (sub.state === 'whatsapp_fallback') {
      await this.initiateWhatsAppFallback(subscriptionId, invoiceId);
    }
  }

  /**
   * Schedule a card retry via BullMQ with smart retry timing.
   */
  private async scheduleRetry(
    subscriptionId: string,
    invoiceId: string,
    amount: number,
    retryCount: number,
    policy: DunningPolicy,
  ) {
    if (!BillingsQueue) {
      this.logger.warn('BullMQ not available, cannot schedule retry', { subscriptionId });
      return;
    }

    const retryAt = nextRetryAt({
      currentTime: new Date(),
      retryCount,
      policy,
    });

    const delayMs = Math.max(0, retryAt.getTime() - Date.now());

    await BillingsQueue.add(
      'cascade_retry',
      {
        subscriptionId,
        invoiceId,
        amount,
        merchantId: 'cascade',
      },
      { delay: delayMs },
    );

    this.logger.info('Cascade retry scheduled', {
      subscriptionId,
      retryCount,
      retryAt: retryAt.toISOString(),
      delayMs,
    });
  }

  /**
   * Transition to VA fallback: create a one-time Virtual Account.
   */
  async initiateVAFallback(
    subscriptionId: string,
    invoiceId: string,
    amount: number,
    merchantId: string,
  ) {
    this.logger.info('Initiating VA fallback', { subscriptionId, invoiceId });

    const repo = new DrizzleSubscriptionRepository(db, merchantId);
    const wrapper = new SubscriptionWrapper({ repo });

    // Load subscription to check current state
    const [sub] = await db
      .select()
      .from(SubscriptionsTable)
      .where(eq(SubscriptionsTable.id, subscriptionId))
      .limit(1);

    if (!sub || sub.state !== 'va_fallback') {
      this.logger.warn('Subscription not in va_fallback state, skipping VA creation', {
        subscriptionId,
        state: sub?.state,
      });
      return;
    }

    try {
      const va = await this.orchestrator.createVirtualAccount({
        context: {
          subscriptionId: sub.id,
          merchantId: sub.merchant_id,
          customerId: sub.customer_id,
          planId: sub.plan_id,
          policy: sub.policy as DunningPolicy,
          retryCount: sub.retry_count,
        },
        amount,
        invoiceId,
        expiresInDays: 7,
      });

      await wrapper.processEvent({
        subscriptionId,
        event: {
          type: 'VA_CREATED',
          vaId: va.vaId,
          expiresAt: va.expiresAt,
        },
        idempotencyKey: `cascade:va_created:${invoiceId}`,
      });

      if (BillingsQueue) {
        await BillingsQueue.add(
          'va_expiry_check',
          { subscriptionId, invoiceId, merchantId },
          { delay: 7 * 24 * 60 * 60 * 1000 },
        );
      }

      this.logger.info('VA created and cascade advanced', {
        subscriptionId,
        vaId: va.vaId,
        accountNumber: va.accountNumber,
      });
    } catch (err) {
      this.logger.error('VA creation failed', err as Error, { subscriptionId });
    }
  }

  /**
   * Handle VA expiry: advance to WhatsApp fallback.
   */
  async handleVAExpiry(subscriptionId: string, invoiceId: string, merchantId: string) {
    this.logger.info('VA expired, advancing to WhatsApp fallback', { subscriptionId });

    const repo = new DrizzleSubscriptionRepository(db, merchantId);
    const wrapper = new SubscriptionWrapper({ repo });

    try {
      const result = await wrapper.processEvent({
        subscriptionId,
        event: { type: 'VA_EXPIRED' },
        idempotencyKey: `cascade:va_expired:${invoiceId}`,
      });

      if (result.state === 'whatsapp_fallback') {
        await this.initiateWhatsAppFallback(subscriptionId, invoiceId);
      }
    } catch (err) {
      this.logger.error('VA expiry handling failed', err as Error, { subscriptionId });
    }
  }

  /**
   * Transition to WhatsApp fallback: send recovery message.
   */
  async initiateWhatsAppFallback(subscriptionId: string, invoiceId: string) {
    this.logger.info('Initiating WhatsApp fallback', { subscriptionId, invoiceId });

    try {
      const [sub] = await db
        .select()
        .from(SubscriptionsTable)
        .where(eq(SubscriptionsTable.id, subscriptionId))
        .limit(1);

      if (!sub) return;

      await this.orchestrator.sendWhatsAppRecovery({
        context: {
          subscriptionId: sub.id,
          merchantId: sub.merchant_id,
          customerId: sub.customer_id,
          planId: sub.plan_id,
          policy: sub.policy as DunningPolicy,
          retryCount: sub.retry_count,
        },
        invoiceId,
      });

      const graceHours = sub.policy?.graceHours ?? 72;
      if (BillingsQueue) {
        await BillingsQueue.add(
          'grace_expiry_check',
          { subscriptionId, merchantId: sub.merchant_id },
          { delay: graceHours * 60 * 60 * 1000 },
        );
      }

      this.logger.info('WhatsApp recovery initiated + grace timer started', {
        subscriptionId,
        graceHours,
      });
    } catch (err) {
      this.logger.error('WhatsApp fallback failed', err as Error, { subscriptionId });
    }
  }

  /**
   * Handle grace expiry: advance to past_due.
   */
  async handleGraceExpiry(subscriptionId: string, merchantId: string) {
    this.logger.info('Grace period expired, advancing to past_due', { subscriptionId });

    const repo = new DrizzleSubscriptionRepository(db, merchantId);
    const wrapper = new SubscriptionWrapper({ repo });

    try {
      await wrapper.processEvent({
        subscriptionId,
        event: { type: 'GRACE_EXPIRED' },
        idempotencyKey: `cascade:grace_expired:${subscriptionId}:${Date.now()}`,
      });

      this.logger.info('Subscription moved to past_due', { subscriptionId });
    } catch (err) {
      this.logger.error('Grace expiry handling failed', err as Error, { subscriptionId });
    }
  }

  /**
   * Initial signup recovery: when a customer's first card fails at subscription
   * creation, generate a VA immediately so they can still subscribe via bank transfer.
   * No card retries — straight to VA.
   */
  async initiateSignupVAFallback(
    subscriptionId: string,
    invoiceId: string,
    amount: number,
    merchantId: string,
  ) {
    this.logger.info('Initiating signup VA fallback', { subscriptionId, invoiceId });

    const repo = new DrizzleSubscriptionRepository(db, merchantId);
    const wrapper = new SubscriptionWrapper({ repo });

    const [sub] = await db
      .select()
      .from(SubscriptionsTable)
      .where(eq(SubscriptionsTable.id, subscriptionId))
      .limit(1);

    if (!sub) {
      this.logger.warn('Subscription not found for signup VA', { subscriptionId });
      return;
    }

    try {
      const va = await this.orchestrator.createVirtualAccount({
        context: {
          subscriptionId: sub.id,
          merchantId: sub.merchant_id,
          customerId: sub.customer_id,
          planId: sub.plan_id,
          policy: sub.policy as DunningPolicy,
          retryCount: 0,
        },
        amount,
        invoiceId,
        expiresInDays: 7,
      });

      // Advance state machine: move from pending/charging to VA fallback then record VA
      await wrapper.processEvent({
        subscriptionId,
        event: { type: 'CYCLE_BOUNDARY_REACHED', invoiceId },
        idempotencyKey: `signup:cycle:${invoiceId}`,
      });

      await wrapper.processEvent({
        subscriptionId,
        event: {
          type: 'VA_CREATED',
          vaId: va.vaId,
          expiresAt: va.expiresAt,
        },
        idempotencyKey: `signup:va_created:${invoiceId}`,
      });

      this.logger.info('Signup VA fallback complete', {
        subscriptionId,
        vaId: va.vaId,
        accountNumber: va.accountNumber,
      });
    } catch (err) {
      this.logger.error('Signup VA fallback failed', err as Error, { subscriptionId });
    }
  }
}
