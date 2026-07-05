// services/engine/src/routes/merchant-actions.ts
//
// Merchant intervention endpoints for subscription management.
// Allows merchants to manually intervene in the cascade process.

import { Router, type Request, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { SubscriptionsTable } from '../schema/subscriptions.schema.js';
import { InvoicesTable } from '../schema/invoices.schema.js';
import { PlansTable } from '../schema/plans.schema.js';
import { CustomersTable } from '../schema/customers.schema.js';
import { DrizzleSubscriptionRepository } from '../db/drizzle-repository.js';
import { SubscriptionWrapper } from '../wrapper/subscription-wrapper.js';
import { RailOrchestrator } from '../rails/orchestrator.js';
import { dispatchWebhookEvent } from '../webhooks/webhook-dispatcher.js';
import { GlobalLogger } from '../utils/logger.js';
import type { DunningPolicy } from '../state-machines/subscription.js';

const logger = new GlobalLogger('MerchantActions');
export const merchantActionsRouter = Router();

// GET /v1/subscriptions/:id — enriched with cascade history + payment methods
merchantActionsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const merchantId = (req as Request & { merchantId: string }).merchantId;
    const [sub] = await db
      .select()
      .from(SubscriptionsTable)
      .where(eq(SubscriptionsTable.id, req.params.id))
      .limit(1);

    if (!sub || sub.merchant_id !== merchantId) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Subscription not found' } });
      return;
    }

    const [customer] = await db.select().from(CustomersTable).where(eq(CustomersTable.id, sub.customer_id)).limit(1);
    const [plan] = await db.select().from(PlansTable).where(eq(PlansTable.id, sub.plan_id)).limit(1);
    const [invoice] = await db.select().from(InvoicesTable).where(eq(InvoicesTable.id, sub.current_invoice_id ?? '')).limit(1);

    // Get charge attempts for current invoice
    const { ChargeAttempts } = await import('../schema/charge_attempts.schema.js');
    const chargeAttempts = sub.current_invoice_id
      ? await db.select().from(ChargeAttempts).where(eq(ChargeAttempts.invoice_id, sub.current_invoice_id))
      : [];

    res.json({
      subscription: sub,
      customer: customer ? { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone } : null,
      plan: plan ? { id: plan.id, name: plan.name, amount: plan.amount } : null,
      current_invoice: invoice,
      charge_attempts: chargeAttempts,
    });
  } catch (err) {
    logger.error('get subscription detail error', err as Error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get subscription' } });
  }
});

// POST /v1/subscriptions/:id/mark-recovered — merchant manually marks as recovered
merchantActionsRouter.post('/:id/mark-recovered', async (req: Request, res: Response) => {
  try {
    const merchantId = (req as Request & { merchantId: string }).merchantId;
    const { reason } = req.body;

    const [sub] = await db
      .select()
      .from(SubscriptionsTable)
      .where(eq(SubscriptionsTable.id, req.params.id))
      .limit(1);

    if (!sub || sub.merchant_id !== merchantId) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Subscription not found' } });
      return;
    }

    const cascadeStates = ['retrying', 'va_fallback', 'whatsapp_fallback', 'past_due'];
    if (!cascadeStates.includes(sub.state)) {
      res.status(400).json({ error: { code: 'INVALID_STATE', message: 'Subscription is not in a cascade state' } });
      return;
    }

    // Mark current invoice as paid
    if (sub.current_invoice_id) {
      await db.update(InvoicesTable).set({
        status: 'paid',
        paid_at: new Date(),
      }).where(eq(InvoicesTable.id, sub.current_invoice_id));
    }

    // Reset subscription to active
    const repo = new DrizzleSubscriptionRepository(db, merchantId);
    const wrapper = new SubscriptionWrapper({ repo });
    await wrapper.processEvent({
      subscriptionId: sub.id,
      event: { type: 'PAYMENT_RECORDED' },
      idempotencyKey: `merchant:recovered:${sub.id}:${Date.now()}`,
    });

    // Fire webhook
    await dispatchWebhookEvent(merchantId, 'cascade.recovered', {
      subscriptionId: sub.id,
      reason: reason ?? 'Manual recovery',
    });

    // Send recovery email
    const orchestrator = new RailOrchestrator({ nomba: null as any });
    const [invoice] = await db.select().from(InvoicesTable).where(eq(InvoicesTable.id, sub.current_invoice_id ?? '')).limit(1);
    await orchestrator.sendPaymentRecoveredEmail({
      customerId: sub.customer_id,
      merchantId,
      invoiceId: sub.current_invoice_id ?? '',
      amount: invoice ? Number(invoice.amount) : 0,
    }).catch(err => logger.error('Failed to send recovery email', err as Error));

    res.json({ success: true, message: 'Subscription marked as recovered' });
  } catch (err) {
    logger.error('mark-recovered error', err as Error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to mark as recovered' } });
  }
});

// POST /v1/subscriptions/:id/send-reminder — merchant sends a payment reminder
merchantActionsRouter.post('/:id/send-reminder', async (req: Request, res: Response) => {
  try {
    const merchantId = (req as Request & { merchantId: string }).merchantId;
    const { channel } = req.body; // 'email' | 'whatsapp' | 'both'

    const [sub] = await db
      .select()
      .from(SubscriptionsTable)
      .where(eq(SubscriptionsTable.id, req.params.id))
      .limit(1);

    if (!sub || sub.merchant_id !== merchantId) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Subscription not found' } });
      return;
    }

    const [invoice] = await db.select().from(InvoicesTable).where(eq(InvoicesTable.id, sub.current_invoice_id ?? '')).limit(1);
    const [customer] = await db.select().from(CustomersTable).where(eq(CustomersTable.id, sub.customer_id)).limit(1);
    const [plan] = await db.select().from(PlansTable).where(eq(PlansTable.id, sub.plan_id)).limit(1);

    const orchestrator = new RailOrchestrator({ nomba: null as any });
    const amount = invoice ? Number(invoice.amount) : 0;
    const dayNumber = sub.retry_count;

    if (channel === 'email' || channel === 'both' || !channel) {
      await orchestrator.sendDunningReminder({
        customerId: sub.customer_id,
        merchantId,
        invoiceId: sub.current_invoice_id ?? '',
        amount,
        dayNumber,
      }).catch(err => logger.error('Failed to send reminder email', err as Error));
    }

    if (channel === 'whatsapp' || channel === 'both' || !channel) {
      await orchestrator.sendWhatsAppRecovery({
        context: {
          subscriptionId: sub.id,
          merchantId: sub.merchant_id,
          customerId: sub.customer_id,
          planId: sub.plan_id,
          policy: sub.policy as DunningPolicy,
          retryCount: sub.retry_count,
        },
        invoiceId: sub.current_invoice_id ?? '',
      }).catch(err => logger.error('Failed to send WhatsApp reminder', err as Error));
    }

    res.json({ success: true, message: `Reminder sent via ${channel ?? 'all channels'}` });
  } catch (err) {
    logger.error('send-reminder error', err as Error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to send reminder' } });
  }
});

// POST /v1/subscriptions/:id/override-state — merchant manually sets subscription state
merchantActionsRouter.post('/:id/override-state', async (req: Request, res: Response) => {
  try {
    const merchantId = (req as Request & { merchantId: string }).merchantId;
    const { state, reason } = req.body;

    const validStates = ['active', 'paused', 'cancelled'];
    if (!validStates.includes(state)) {
      res.status(400).json({ error: { code: 'INVALID_STATE', message: `Must be one of: ${validStates.join(', ')}` } });
      return;
    }

    const [sub] = await db
      .select()
      .from(SubscriptionsTable)
      .where(eq(SubscriptionsTable.id, req.params.id))
      .limit(1);

    if (!sub || sub.merchant_id !== merchantId) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Subscription not found' } });
      return;
    }

    const repo = new DrizzleSubscriptionRepository(db, merchantId);
    const wrapper = new SubscriptionWrapper({ repo });

    // Map desired state to event
    const eventMap: Record<string, string> = {
      active: 'PAYMENT_RECORDED',
      paused: 'PAUSE_REQUESTED',
      cancelled: 'CANCEL_REQUESTED',
    };

    const event = eventMap[state];
    if (event) {
      await wrapper.processEvent({
        subscriptionId: sub.id,
        event: { type: event as any, actor: 'merchant', reason: reason ?? `Manual override to ${state}` },
        idempotencyKey: `merchant:override:${sub.id}:${state}:${Date.now()}`,
      });
    }

    await dispatchWebhookEvent(merchantId, `subscription.${state}` as any, {
      subscriptionId: sub.id,
      previousState: sub.state,
      reason: reason ?? `Manual override`,
    });

    res.json({ success: true, message: `Subscription overridden to ${state}` });
  } catch (err) {
    logger.error('override-state error', err as Error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to override state' } });
  }
});
