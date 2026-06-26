import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { SubscriptionsTable } from '../schema/subscriptions.schema.js';
import { PlansTable } from '../schema/plans.schema.js';
import { CustomersTable } from '../schema/customers.schema.js';
import { DrizzleSubscriptionRepository } from '../db/drizzle-repository.js';
import { SubscriptionWrapper } from '../wrapper/subscription-wrapper.js';
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
    periodEnd.setMonth(periodEnd.getMonth() + (plan.interval_count ?? 1));

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

    res.json({ data: subscriptions, total: subscriptions.length });
  } catch (err) {
    console.error('[subscriptions] list error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list subscriptions' } });
  }
});

subscriptionsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const [subscription] = await db
      .select()
      .from(SubscriptionsTable)
      .where(
        and(
          eq(SubscriptionsTable.id, req.params.id),
          eq(SubscriptionsTable.merchant_id, req.merchantId),
        ),
      )
      .limit(1);

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

    const existing = await db
      .select()
      .from(SubscriptionsTable)
      .where(
        and(
          eq(SubscriptionsTable.id, req.params.id),
          eq(SubscriptionsTable.merchant_id, req.merchantId),
        ),
      )
      .limit(1);

    if (!existing.length) {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Subscription not found' } });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (plan_id !== undefined) updates.plan_id = plan_id;
    if (cancel_at_period_end !== undefined) updates.cancel_at_period_end = cancel_at_period_end;
    if (metadata !== undefined) updates.metadata = metadata;

    if (plan_id) {
      const [newPlan] = await db
        .select()
        .from(PlansTable)
        .where(and(eq(PlansTable.id, plan_id), eq(PlansTable.merchant_id, req.merchantId)))
        .limit(1);

      if (!newPlan) {
        res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'New plan not found' } });
        return;
      }
    }

    if (Object.keys(updates).length > 0) {
      const [updated] = await db
        .update(SubscriptionsTable)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set(updates as any)
        .where(
          and(
            eq(SubscriptionsTable.id, req.params.id),
            eq(SubscriptionsTable.merchant_id, req.merchantId),
          ),
        )
        .returning();
      res.json(updated);
    } else {
      res.json(existing[0]);
    }
  } catch (err) {
    console.error('[subscriptions] patch error:', err);
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
    const { new_plan_id, effective_date } = req.body;

    if (!new_plan_id) {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'new_plan_id is required' } });
      return;
    }

    const [subscription] = await db
      .select()
      .from(SubscriptionsTable)
      .where(
        and(
          eq(SubscriptionsTable.id, req.params.id),
          eq(SubscriptionsTable.merchant_id, req.merchantId),
        ),
      )
      .limit(1);

    if (!subscription) {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Subscription not found' } });
      return;
    }

    const [currentPlan] = await db
      .select()
      .from(PlansTable)
      .where(and(eq(PlansTable.id, subscription.plan_id), eq(PlansTable.merchant_id, req.merchantId)))
      .limit(1);

    const [newPlan] = await db
      .select()
      .from(PlansTable)
      .where(and(eq(PlansTable.id, new_plan_id), eq(PlansTable.merchant_id, req.merchantId)))
      .limit(1);

    if (!currentPlan || !newPlan) {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Plan not found' } });
      return;
    }

    const periodStart = subscription.current_period_start ?? new Date();
    const periodEnd = subscription.current_period_end ?? new Date();
    const effectiveAt = effective_date ? new Date(effective_date) : new Date();

    const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / 86_400_000);
    const remainingDays = Math.max(0, Math.ceil((periodEnd.getTime() - effectiveAt.getTime()) / 86_400_000));

    const creditAmount = (currentPlan.amount / totalDays) * remainingDays;
    const chargeAmount = (newPlan.amount / totalDays) * remainingDays;
    const netAmount = chargeAmount - creditAmount;

    res.json({
      current_plan: {
        id: currentPlan.id,
        name: currentPlan.name,
        amount: currentPlan.amount,
        currency: currentPlan.currency,
        interval: currentPlan.interval,
      },
      new_plan: {
        id: newPlan.id,
        name: newPlan.name,
        amount: newPlan.amount,
        currency: newPlan.currency,
        interval: newPlan.interval,
      },
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      effective_date: effectiveAt.toISOString(),
      remaining_days: remainingDays,
      total_days_in_period: totalDays,
      credit: {
        amount: Math.round(creditAmount * 100) / 100,
        description: `Unused portion of ${currentPlan.name}`,
      },
      charge: {
        amount: Math.round(chargeAmount * 100) / 100,
        description: `Prorated charge for ${newPlan.name} for ${remainingDays} days`,
      },
      net_amount: Math.round(netAmount * 100) / 100,
      currency: currentPlan.currency,
    });
  } catch (err) {
    console.error('[subscriptions] preview error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to compute preview' } });
  }
});
