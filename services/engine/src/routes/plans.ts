import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { PlansTable } from '../schema/plans.schema.js';
import type { Request, Response } from 'express';

export const plansRouter = Router();

plansRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, amount, currency, interval, interval_count, is_active, metadata } = req.body;

    if (!name || amount === undefined || !interval) {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'name, amount, and interval are required' } });
      return;
    }

    const [plan] = await db.insert(PlansTable).values({
      merchant_id: req.merchantId,
      name,
      description: description ?? null,
      amount,
      currency: currency ?? 'NGN',
      interval,
      interval_count: interval_count ?? 1,
      is_active: is_active ?? true,
      metadata: metadata ?? {},
    }).returning();

    res.status(201).json(plan);
  } catch (err) {
    console.error('[plans] create error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create plan' } });
  }
});

plansRouter.get('/', async (req: Request, res: Response) => {
  try {
    const plans = await db
      .select()
      .from(PlansTable)
      .where(eq(PlansTable.merchant_id, req.merchantId));

    res.json({ data: plans, total: plans.length });
  } catch (err) {
    console.error('[plans] list error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list plans' } });
  }
});

plansRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const [plan] = await db
      .select()
      .from(PlansTable)
      .where(
        and(
          eq(PlansTable.id, req.params.id),
          eq(PlansTable.merchant_id, req.merchantId),
        ),
      )
      .limit(1);

    if (!plan) {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Plan not found' } });
      return;
    }

    res.json(plan);
  } catch (err) {
    console.error('[plans] get error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get plan' } });
  }
});
