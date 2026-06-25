import { Router } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { InvoicesTable } from '../schema/invoices.schema.js';
import { ChargeAttempts } from '../schema/charge_attempts.schema.js';
import { SubscriptionsTable } from '../schema/subscriptions.schema.js';
import type { Request, Response } from 'express';

export const invoicesRouter = Router();

invoicesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const invoices = await db
      .select()
      .from(InvoicesTable)
      .where(eq(InvoicesTable.merchant_id, req.merchantId))
      .orderBy(desc(InvoicesTable.created_at));

    res.json({ data: invoices, total: invoices.length });
  } catch (err) {
    console.error('[invoices] list error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list invoices' } });
  }
});

invoicesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const [invoice] = await db
      .select()
      .from(InvoicesTable)
      .where(
        and(
          eq(InvoicesTable.id, req.params.id),
          eq(InvoicesTable.merchant_id, req.merchantId),
        ),
      )
      .limit(1);

    if (!invoice) {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Invoice not found' } });
      return;
    }

    const chargeAttempts = await db
      .select()
      .from(ChargeAttempts)
      .where(
        and(
          eq(ChargeAttempts.invoice_id, req.params.id),
          eq(ChargeAttempts.merchant_id, req.merchantId),
        ),
      )
      .orderBy(desc(ChargeAttempts.attempted_at));

    res.json({ ...invoice, charge_attempts: chargeAttempts });
  } catch (err) {
    console.error('[invoices] get error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get invoice' } });
  }
});

invoicesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { subscription_id, amount, due_date } = req.body;

    if (!subscription_id || !amount || !due_date) {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'subscription_id, amount, and due_date are required' } });
      return;
    }

    const [subscription] = await db
      .select()
      .from(SubscriptionsTable)
      .where(
        and(
          eq(SubscriptionsTable.id, subscription_id),
          eq(SubscriptionsTable.merchant_id, req.merchantId),
        ),
      )
      .limit(1);

    if (!subscription) {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Subscription not found' } });
      return;
    }

    const [invoice] = await db.insert(InvoicesTable).values({
      subscription_id,
      merchant_id: req.merchantId,
      amount: amount.toString(),
      due_date: new Date(due_date),
      status: 'open',
    }).returning();

    res.status(201).json(invoice);
  } catch (err) {
    console.error('[invoices] create error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create invoice' } });
  }
});

invoicesRouter.post('/:id/retry', async (req: Request, res: Response) => {
  try {
    const [invoice] = await db
      .select()
      .from(InvoicesTable)
      .where(
        and(
          eq(InvoicesTable.id, req.params.id),
          eq(InvoicesTable.merchant_id, req.merchantId),
        ),
      )
      .limit(1);

    if (!invoice) {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Invoice not found' } });
      return;
    }

    const nextAttemptAt = new Date();
    nextAttemptAt.setHours(nextAttemptAt.getHours() + 2);

    await db
      .update(InvoicesTable)
      .set({ status: 'pending_retry', next_attempt_at: nextAttemptAt })
      .where(
        and(
          eq(InvoicesTable.id, req.params.id),
          eq(InvoicesTable.merchant_id, req.merchantId),
        ),
      );

    res.json({
      invoice_id: req.params.id,
      status: 'retry_initiated',
      next_attempt_at: nextAttemptAt.toISOString(),
    });
  } catch (err) {
    console.error('[invoices] retry error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to retry invoice' } });
  }
});
