import { Router } from 'express';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { SubscriptionsTable } from '../schema/subscriptions.schema.js';
import { PlansTable } from '../schema/plans.schema.js';
import { InvoicesTable } from '../schema/invoices.schema.js';
import { CustomersTable } from '../schema/customers.schema.js';
import { ChargeAttempts } from '../schema/charge_attempts.schema.js';
import { DrizzleSubscriptionRepository } from '../db/drizzle-repository.js';
import { SubscriptionWrapper } from '../wrapper/subscription-wrapper.js';
import { handlePlanChange } from '../proration/plan-change.js';
import { applyPauseAdjustments } from '../proration/pause-subcription.js';
import { applyResumeAdjustments } from '../proration/resume-plan.js';
import { preview as prorationPreview } from '../invoice/preview.js';
import { createBillingHandler } from '../rails/billing-handler-dependencies.js';
import type { Request, Response } from 'express';

export const subscriptionsRouter = Router();

subscriptionsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { customer_id, plan_id, start_date, trial_end } = req.body;

    if (!customer_id || !plan_id) {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'customer_id and plan_id are required' } });
      return;
    }

    const [plan] = await db
      .select()
      .from(PlansTable)
      .where(
        and(
          eq(PlansTable.id, plan_id),
          eq(PlansTable.merchant_id, req.merchantId),
        ),
      )
      .limit(1);

    if (!plan) {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Plan not found' } });
      return;
    }

    const [customer] = await db
      .select()
      .from(CustomersTable)
      .where(
        and(
          eq(CustomersTable.id, customer_id),
          eq(CustomersTable.merchant_id, req.merchantId),
        ),
      )
      .limit(1);

    if (!customer) {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    const now = new Date();
    const periodStart = start_date ? new Date(start_date) : now;
    const periodEnd = new Date(periodStart);
    const interval = plan.interval ?? 'monthly';
    const count = plan.interval_count ?? 1;
    switch (interval) {
      case 'daily': periodEnd.setDate(periodEnd.getDate() + count); break;
      case 'weekly': periodEnd.setDate(periodEnd.getDate() + 7 * count); break;
      case 'annual': periodEnd.setFullYear(periodEnd.getFullYear() + count); break;
      default: periodEnd.setMonth(periodEnd.getMonth() + count); break;
    }

    const [subscription] = await db.insert(SubscriptionsTable).values({
      merchant_id: req.merchantId,
      customer_id,
      plan_id,
      policy: {
        maxRetries: 3,
        ussdEnabled: true,
        graceHours: 72,
        baseDelayMinutes: 60,
        maxDelayHours: 72,
      },
      state: trial_end ? 'trialing' : 'active',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      trial_ends_at: trial_end ? new Date(trial_end) : null,
      next_billing_at: periodEnd,
    }).returning();

    // Create initial invoice — customer is charged immediately at signup
    try {
      await db.insert(InvoicesTable).values({
        subscription_id: subscription.id,
        merchant_id: req.merchantId,
        amount: String(plan.amount),
        currency: 'NGN',
        status: 'paid',
        description: plan.name + ' - First Month',
        due_date: new Date(),
        paid_at: new Date(),
      });
    } catch (invErr) {
      console.error('[subscriptions] invoice creation error:', invErr);
    }

    res.status(201).json(subscription);
  } catch (err) {
    console.error('[subscriptions] create error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create subscription' } });
  }
});

subscriptionsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const subscriptions = await db
      .select()
      .from(SubscriptionsTable)
      .where(eq(SubscriptionsTable.merchant_id, req.merchantId));

    // For cascade-state subs, fetch charge attempt history
    const cascadeStates = ['retrying', 'va_fallback', 'whatsapp_fallback', 'past_due'];
    const cascadeSubs = subscriptions.filter(s => cascadeStates.includes(s.state));

    let cascadeHistoryMap: Record<string, Array<{step: string; status: string; attempted_at: string}>> = {};

    if (cascadeSubs.length > 0) {
      // Get invoice IDs for cascade subs
      const invoiceIds = cascadeSubs
        .filter(s => s.current_invoice_id)
        .map(s => s.current_invoice_id!);

      if (invoiceIds.length > 0) {
        const attempts = await db
          .select()
          .from(ChargeAttempts)
          .where(inArray(ChargeAttempts.invoice_id, invoiceIds));

        for (const attempt of attempts) {
          const subId = cascadeSubs.find(s => s.current_invoice_id === attempt.invoice_id)?.id;
          if (subId) {
            if (!cascadeHistoryMap[subId]) cascadeHistoryMap[subId] = [];
            // Map charge attempt status to cascade step
            const step = attempt.reason?.includes('virtual account') ? 'virtual_account'
              : attempt.reason?.includes('ussd') ? 'ussd'
              : attempt.reason?.includes('whatsapp') ? 'whatsapp'
              : 'card';
            cascadeHistoryMap[subId].push({
              step,
              status: attempt.status === 'failed' ? 'failed' : 'success',
              attempted_at: attempt.attempted_at?.toISOString?.() ?? String(attempt.attempted_at),
            });
          }
        }
      }
    }

    const enriched = subscriptions.map(s => ({
      ...s,
      cascade_history: cascadeHistoryMap[s.id] ?? [],
    }));

    res.json({ data: enriched, total: enriched.length });
  } catch (err) {
    console.error('[subscriptions] list error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list subscriptions' } });
  }
});

subscriptionsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const [subscription] = await db.transaction(async (tx) => {
      await tx.execute(`SET LOCAL app.current_merchant_id='${req.merchantId}'`);
      return tx
        .select()
        .from(SubscriptionsTable)
        .where(
          and(
            eq(SubscriptionsTable.id, req.params.id),
            eq(SubscriptionsTable.merchant_id, req.merchantId),
          ),
        )
        .limit(1);
    });

    if (!subscription) {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Subscription not found' } });
      return;
    }

    res.json(subscription);
  } catch (err) {
    console.error('[subscriptions] get error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get subscription' } });
  }
});

subscriptionsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { plan_id, cancel_at_period_end, metadata } = req.body;

    const [existing] = await db
      .select()
      .from(SubscriptionsTable)
      .where(
        and(
          eq(SubscriptionsTable.id, req.params.id),
          eq(SubscriptionsTable.merchant_id, req.merchantId),
        ),
      )
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Subscription not found' } });
      return;
    }

    if (plan_id && plan_id !== existing.plan_id) {
      const billingHandler = createBillingHandler(req.merchantId);
      const idempotencyKey = req.headers['idempotency-key'] as string ?? `plan-change-${req.params.id}-${Date.now()}`;
      await handlePlanChange(
        req.params.id,
        existing.plan_id,
        plan_id,
        req.merchantId,
        billingHandler,
        idempotencyKey,
      );
      const [updated] = await db
        .select()
        .from(SubscriptionsTable)
        .where(eq(SubscriptionsTable.id, req.params.id))
        .limit(1);
      res.json(updated);
      return;
    }

    const updates: Record<string, unknown> = {};
    if (cancel_at_period_end !== undefined) updates.cancel_at_period_end = cancel_at_period_end;
    if (metadata !== undefined) updates.metadata = metadata;

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date();
      const [updated] = await db
        .update(SubscriptionsTable)
        .set(updates)
        .where(
          and(
            eq(SubscriptionsTable.id, req.params.id),
            eq(SubscriptionsTable.merchant_id, req.merchantId),
          ),
        )
        .returning();
      res.json(updated);
    } else {
      res.json(existing);
    }
  } catch (err) {
    console.error('[subscriptions] patch error:', err);
    if (err instanceof Error) {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: err.message } });
      return;
    }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update subscription' } });
  }
});

subscriptionsRouter.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const repo = new DrizzleSubscriptionRepository(db, req.merchantId);
    const wrapper = new SubscriptionWrapper({ repo });

    const result = await wrapper.processEvent({
      subscriptionId: req.params.id,
      event: { type: 'CANCEL_REQUESTED', actor: 'merchant', reason: req.body.reason },
      idempotencyKey: req.headers['idempotency-key'] as string ?? `cancel-${req.params.id}-${Date.now()}`,
    });

    res.json({ state: result.state, context: result.context, cached: result.cached });
  } catch (err) {
    console.error('[subscriptions] cancel error:', err);
    if (err instanceof Error && err.name === 'SubscriptionNotFoundError') {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Subscription not found' } });
      return;
    }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel subscription' } });
  }
});

subscriptionsRouter.post('/:id/pause', async (req: Request, res: Response) => {
  try {
    const repo = new DrizzleSubscriptionRepository(db, req.merchantId);
    const wrapper = new SubscriptionWrapper({ repo });

    const result = await wrapper.processEvent({
      subscriptionId: req.params.id,
      event: { type: 'PAUSE_REQUESTED', actor: 'customer' },
      idempotencyKey: req.headers['idempotency-key'] as string ?? `pause-${req.params.id}-${Date.now()}`,
    });

    if (!result.cached) {
      await applyPauseAdjustments(req.params.id, req.merchantId);
    }

    res.json({ state: result.state, context: result.context, cached: result.cached });
  } catch (err) {
    console.error('[subscriptions] pause error:', err);
    if (err instanceof Error && err.name === 'SubscriptionNotFoundError') {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Subscription not found' } });
      return;
    }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to pause subscription' } });
  }
});

subscriptionsRouter.post('/:id/resume', async (req: Request, res: Response) => {
  try {
    const repo = new DrizzleSubscriptionRepository(db, req.merchantId);
    const wrapper = new SubscriptionWrapper({ repo });

    const result = await wrapper.processEvent({
      subscriptionId: req.params.id,
      event: { type: 'RESUME_REQUESTED', actor: 'customer' },
      idempotencyKey: req.headers['idempotency-key'] as string ?? `resume-${req.params.id}-${Date.now()}`,
    });

    if (!result.cached) {
      await applyResumeAdjustments(req.params.id, req.merchantId);
    }

    res.json({ state: result.state, context: result.context, cached: result.cached });
  } catch (err) {
    console.error('[subscriptions] resume error:', err);
    if (err instanceof Error && err.name === 'SubscriptionNotFoundError') {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Subscription not found' } });
      return;
    }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to resume subscription' } });
  }
});

subscriptionsRouter.post('/:id/preview', async (req: Request, res: Response) => {
  try {
    const { new_plan_id } = req.body;

    if (!new_plan_id) {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'new_plan_id is required' } });
      return;
    }

    const result = await prorationPreview(req.params.id, new_plan_id, req.merchantId);

    res.json(result);
  } catch (err) {
    console.error('[subscriptions] preview error:', err);
    if (err instanceof Error) {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: err.message } });
      return;
    }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to compute preview' } });
  }
});
