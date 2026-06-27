import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { PaymentMethodsTable } from '../schema/payment_methods.schema.js';
import { CustomersTable } from '../schema/customers.schema.js';
import type { Request, Response } from 'express';

export const paymentMethodsRouter = Router();

paymentMethodsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { customer_id, type, nomba_token, last4, brand, exp_month, exp_year, is_default, metadata } = req.body;

    if (!customer_id || !type || !nomba_token) {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'customer_id, type, and nomba_token are required' } });
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

    const [pm] = await db.insert(PaymentMethodsTable).values({
      customer_id,
      type,
      nomba_token,
      merchant_id: req.merchantId,
      last4: last4 ?? '',
      brand: brand ?? '',
      exp_month: exp_month?.toString() ?? '',
      exp_year: exp_year?.toString() ?? '',
      is_default: is_default ?? false,
      metadata: metadata ?? {},
    }).returning();

    res.status(201).json(pm);
  } catch (err) {
    console.error('[payment-methods] create error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create payment method' } });
  }
});

paymentMethodsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { customer_id } = req.query;

    const conditions = [eq(PaymentMethodsTable.merchant_id, req.merchantId)];
    if (customer_id) {
      conditions.push(eq(PaymentMethodsTable.customer_id, customer_id as string));
    }

    const methods = await db
      .select()
      .from(PaymentMethodsTable)
      .where(and(...conditions));

    res.json({ data: methods, total: methods.length });
  } catch (err) {
    console.error('[payment-methods] list error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list payment methods' } });
  }
});

paymentMethodsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const [pm] = await db
      .select()
      .from(PaymentMethodsTable)
      .where(
        and(
          eq(PaymentMethodsTable.id, req.params.id),
          eq(PaymentMethodsTable.merchant_id, req.merchantId),
        ),
      )
      .limit(1);

    if (!pm) {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Payment method not found' } });
      return;
    }

    res.json(pm);
  } catch (err) {
    console.error('[payment-methods] get error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get payment method' } });
  }
});

paymentMethodsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const [pm] = await db
      .select()
      .from(PaymentMethodsTable)
      .where(
        and(
          eq(PaymentMethodsTable.id, req.params.id),
          eq(PaymentMethodsTable.merchant_id, req.merchantId),
        ),
      )
      .limit(1);

    if (!pm) {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Payment method not found' } });
      return;
    }

    await db
      .update(PaymentMethodsTable)
      .set({ deleted_at: new Date() })
      .where(
        and(
          eq(PaymentMethodsTable.id, req.params.id),
          eq(PaymentMethodsTable.merchant_id, req.merchantId),
        ),
      );

    res.json({ id: req.params.id, deleted: true });
  } catch (err) {
    console.error('[payment-methods] delete error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete payment method' } });
  }
});
